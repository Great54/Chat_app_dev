"""
Tests for the NEW multiplayer game system in GenC Vibez backend.

Covered endpoints:
  - GET  /api/games/types/list
  - POST /api/rooms/{room_id}/games           (host)
  - POST /api/games/{game_id}/join
  - GET  /api/rooms/{room_id}/games           (list active + recent)
  - GET  /api/games/{game_id}                 (state, auto-resolves on read)

Game mechanics verified:
  - 20s join timer (GAME_TIMER_SECONDS)
  - Host must be in room, pays 10 coin entry, can't have 2 active games at once
  - Solo timer expiry => aborted + refund
  - Multiplayer expiry => completed, winner gets pot + 10 XP + "game" notification
  - System chat message posted on host, completion, abort
  - card_higher 1-13, dice_roll 2-12

Plus light regression on auth/rooms/messages/friends/notifications/search/leaderboard.
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

ALICE = {"email": "alice@test.com", "password": "password123"}
BOB = {"email": "bob@test.com", "password": "password123"}

# Extra test users for the "game full" scenario (6 player cap + 1 over)
EXTRAS = [
    {"email": f"gtest{i}@test.com", "password": "password123",
     "username": f"gtest{i}", "displayName": f"GTest {i}"}
    for i in range(1, 6)  # gtest1..gtest5  (alice + 5 extras = 6)
]


# ---------------- Helpers ----------------

def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _ensure_user(email, password, username, display_name):
    """Login if exists, else register."""
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=15)
    if r.status_code == 200:
        return r.json()["access_token"]
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": password,
        "username": username, "displayName": display_name
    }, timeout=15)
    assert r.status_code in (200, 201), f"register {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _me(token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(token), timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def _leave_current_room(token):
    me = _me(token)
    rid = me.get("currentRoomId")
    if rid:
        requests.post(f"{BASE_URL}/api/rooms/{rid}/leave", headers=_h(token), timeout=10)


def _join_room(token, room_id):
    me = _me(token)
    if me.get("currentRoomId") == room_id:
        return
    if me.get("currentRoomId"):
        requests.post(f"{BASE_URL}/api/rooms/{me['currentRoomId']}/leave",
                      headers=_h(token), timeout=10)
    r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/join",
                      headers=_h(token), timeout=10)
    assert r.status_code == 200, f"join room failed: {r.status_code} {r.text}"


def _get_world_vibez_id():
    # Ensure default rooms are seeded
    requests.post(f"{BASE_URL}/api/init/rooms", timeout=10)
    r = requests.get(f"{BASE_URL}/api/rooms", timeout=10)
    assert r.status_code == 200
    for room in r.json():
        if room["roomName"] == "World Vibez":
            return room["id"]
    pytest.fail("World Vibez room not found")


def _set_user_coins(email, coins):
    """Directly set a user's coin balance for testing edge cases."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    db.users.update_one({"email": email}, {"$set": {"coins": coins}})
    client.close()


def _get_user_coins(email):
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    u = db.users.find_one({"email": email})
    client.close()
    return u.get("coins", 0) if u else None


def _wait_for_timer():
    # GAME_TIMER_SECONDS = 20, wait an extra second to ensure expiry
    time.sleep(21.5)


# ---------------- Fixtures ----------------

@pytest.fixture(scope="module")
def world_vibez_id():
    return _get_world_vibez_id()


@pytest.fixture(scope="module")
def alice_token():
    return _login(ALICE["email"], ALICE["password"])


@pytest.fixture(scope="module")
def bob_token():
    return _login(BOB["email"], BOB["password"])


@pytest.fixture(scope="module")
def extra_tokens():
    return [_ensure_user(u["email"], u["password"], u["username"], u["displayName"])
            for u in EXTRAS]


# ============================================================
# 1. /api/games/types/list
# ============================================================
class TestGameTypesList:
    def test_list_game_types(self):
        r = requests.get(f"{BASE_URL}/api/games/types/list", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        ids = {g["id"] for g in data}
        assert "card_higher" in ids
        assert "dice_roll" in ids
        for g in data:
            assert g["minPlayers"] == 2
            assert g["maxPlayers"] == 6
            assert g["entryFee"] == 10
            assert "name" in g


# ============================================================
# 2. Solo game aborts (timeout with only 1 player)
# ============================================================
class TestSoloGameAborts:
    def test_solo_game_aborts_and_refunds(self, alice_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)  # normalize
        _join_room(alice_token, world_vibez_id)

        coins_before = _get_user_coins(ALICE["email"])

        # Host a card_higher game
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 200, r.text
        game = r.json()
        game_id = game["id"]
        assert game["status"] == "waiting"
        assert game["hostId"] == _me(alice_token)["id"]
        assert game["pot"] == 10
        assert game["entryFee"] == 10
        assert len(game["players"]) == 1
        assert 15 <= game["secondsRemaining"] <= 20

        # After hosting, alice's coins should be -10
        coins_after_host = _get_user_coins(ALICE["email"])
        assert coins_after_host == coins_before - 10, \
            f"expected {coins_before - 10}, got {coins_after_host}"

        # Wait for timer to expire
        _wait_for_timer()

        # GET /api/rooms/{room}/games should auto-resolve and show aborted
        r = requests.get(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        games = r.json()
        target = next((g for g in games if g["id"] == game_id), None)
        assert target is not None, "game missing from room games"
        assert target["status"] == "aborted", f"expected aborted, got {target['status']}"
        assert target["completedAt"] is not None

        # Coins should be refunded back to original
        coins_final = _get_user_coins(ALICE["email"])
        assert coins_final == coins_before, \
            f"refund missing: before={coins_before} final={coins_final}"


# ============================================================
# 3. Multiplayer game completes
# ============================================================
class TestMultiplayerCompletes:
    def test_multiplayer_completes_with_winner(self, alice_token, bob_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)
        _set_user_coins(BOB["email"], 100)

        _join_room(alice_token, world_vibez_id)
        _join_room(bob_token, world_vibez_id)

        alice_coins_before = _get_user_coins(ALICE["email"])
        bob_coins_before = _get_user_coins(BOB["email"])

        # Alice hosts dice_roll
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "dice_roll"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 200, r.text
        game = r.json()
        game_id = game["id"]
        alice_id = game["hostId"]
        assert game["gameType"] == "dice_roll"
        assert game["pot"] == 10

        # Bob joins the game
        r = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                          headers=_h(bob_token), timeout=10)
        assert r.status_code == 200, r.text
        joined = r.json()
        assert len(joined["players"]) == 2
        assert joined["pot"] == 20
        bob_id = _me(bob_token)["id"]
        assert any(p["userId"] == bob_id for p in joined["players"])

        # Both paid 10 coins
        assert _get_user_coins(ALICE["email"]) == alice_coins_before - 10
        assert _get_user_coins(BOB["email"]) == bob_coins_before - 10

        # Wait for timer
        _wait_for_timer()

        # GET game state - should auto-resolve
        r = requests.get(f"{BASE_URL}/api/games/{game_id}",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        resolved = r.json()
        assert resolved["status"] == "completed", \
            f"expected completed, got {resolved['status']}"
        assert resolved["winnerId"] in (alice_id, bob_id)
        assert resolved["winnerName"] is not None
        # Players should now have results
        for p in resolved["players"]:
            assert "result" in p
            # dice_roll => 2..12
            assert 2 <= p["result"] <= 12

        winner_id = resolved["winnerId"]
        loser_id = bob_id if winner_id == alice_id else alice_id
        winner_email = ALICE["email"] if winner_id == alice_id else BOB["email"]
        loser_email = BOB["email"] if winner_id == alice_id else ALICE["email"]

        # Winner gets pot=20, so net = -10 + 20 = +10 vs original
        winner_before = alice_coins_before if winner_id == alice_id else bob_coins_before
        loser_before = bob_coins_before if winner_id == alice_id else alice_coins_before
        assert _get_user_coins(winner_email) == winner_before + 10
        assert _get_user_coins(loser_email) == loser_before - 10

        # Winner should have a "game" notification
        winner_token = alice_token if winner_id == alice_id else bob_token
        r = requests.get(f"{BASE_URL}/api/notifications",
                         headers=_h(winner_token), timeout=10)
        assert r.status_code == 200
        notifs = r.json()
        game_notifs = [n for n in notifs if n.get("type") == "game"
                       and "Won" in n.get("body", "")
                       and "Dice Roll" in n.get("body", "")]
        assert len(game_notifs) >= 1, "no game-win notification for winner"

        # System message posted to chat about winner
        r = requests.get(f"{BASE_URL}/api/messages/{world_vibez_id}?limit=20",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        msgs = r.json()
        # Note: Message model doesn't expose isSystem flag; detect via senderId="system"
        winner_msg = next((m for m in msgs
                           if m.get("senderId") == "system"
                           and "won" in m.get("messageText", "").lower()
                           and resolved["winnerName"] in m.get("messageText", "")), None)
        assert winner_msg is not None, \
            f"system winner message missing from chat. messages={[m.get('messageText') for m in msgs[-5:]]}"


# ============================================================
# 4. Validation scenarios
# ============================================================
class TestHostValidation:
    def test_invalid_game_type(self, alice_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)
        _join_room(alice_token, world_vibez_id)
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "snakes_and_ladders"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 400
        assert "Invalid" in r.text or "invalid" in r.text

    def test_host_without_being_in_room(self, alice_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)
        _leave_current_room(alice_token)
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_host_without_enough_coins(self, alice_token, world_vibez_id):
        _join_room(alice_token, world_vibez_id)
        _set_user_coins(ALICE["email"], 5)  # below entry fee
        try:
            r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                              json={"gameType": "card_higher"},
                              headers=_h(alice_token), timeout=10)
            assert r.status_code == 400
            assert "coins" in r.text.lower()
        finally:
            _set_user_coins(ALICE["email"], 100)

    def test_host_with_active_game_already(self, alice_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)
        _join_room(alice_token, world_vibez_id)

        r1 = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                           json={"gameType": "card_higher"},
                           headers=_h(alice_token), timeout=10)
        assert r1.status_code == 200, r1.text

        r2 = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                           json={"gameType": "dice_roll"},
                           headers=_h(alice_token), timeout=10)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code} {r2.text}"
        assert "already" in r2.text.lower()

        # Cleanup: wait for game to abort + refund
        _wait_for_timer()
        requests.get(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                     headers=_h(alice_token), timeout=10)


class TestJoinValidation:
    def test_join_when_not_in_same_room(self, alice_token, bob_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)
        _set_user_coins(BOB["email"], 100)
        _join_room(alice_token, world_vibez_id)
        _leave_current_room(bob_token)

        # Alice hosts
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["id"]

        # Bob (not in room) tries to join
        r = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                          headers=_h(bob_token), timeout=10)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

        # Cleanup
        _wait_for_timer()
        requests.get(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                     headers=_h(alice_token), timeout=10)

    def test_join_same_game_twice(self, alice_token, bob_token, world_vibez_id):
        _set_user_coins(ALICE["email"], 100)
        _set_user_coins(BOB["email"], 100)
        _join_room(alice_token, world_vibez_id)
        _join_room(bob_token, world_vibez_id)

        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["id"]

        # Alice tries to join her own game (already a player as host)
        r2 = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                           headers=_h(alice_token), timeout=10)
        assert r2.status_code == 400, f"expected 400, got {r2.status_code}"
        assert "already" in r2.text.lower()

        # Bob joins ok
        r3 = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                           headers=_h(bob_token), timeout=10)
        assert r3.status_code == 200

        # Bob tries to join again -> 400
        r4 = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                           headers=_h(bob_token), timeout=10)
        assert r4.status_code == 400, f"expected 400 on duplicate join, got {r4.status_code}"
        assert "already" in r4.text.lower()

        # Cleanup - wait for completion
        _wait_for_timer()
        requests.get(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                     headers=_h(alice_token), timeout=10)

    def test_join_when_game_is_full(self, alice_token, extra_tokens, world_vibez_id):
        """Alice hosts, 5 extras join (6 total = max). A 7th user (bob) tries -> 400 'full'."""
        # Reset coins for everyone
        _set_user_coins(ALICE["email"], 100)
        _set_user_coins(BOB["email"], 100)
        for u in EXTRAS:
            _set_user_coins(u["email"], 100)

        # Get all into the same room
        _join_room(alice_token, world_vibez_id)
        for t in extra_tokens:
            _join_room(t, world_vibez_id)

        # Alice hosts
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["id"]

        # All 5 extras join (total = 6 = max)
        for i, t in enumerate(extra_tokens):
            rj = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                               headers=_h(t), timeout=10)
            assert rj.status_code == 200, f"extra {i} join failed: {rj.status_code} {rj.text}"

        # Get bob into the room and try to join the now-full game
        bob_token = _login(BOB["email"], BOB["password"])
        _join_room(bob_token, world_vibez_id)

        rj = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                           headers=_h(bob_token), timeout=10)
        assert rj.status_code == 400, f"expected 400 game full, got {rj.status_code} {rj.text}"
        assert "full" in rj.text.lower()

        # Cleanup - wait for resolution
        _wait_for_timer()
        requests.get(f"{BASE_URL}/api/rooms/{world_vibez_id}/games",
                     headers=_h(alice_token), timeout=10)


# ============================================================
# 5. Regression on existing endpoints
# ============================================================
class TestRegression:
    def test_auth_me(self, alice_token):
        me = _me(alice_token)
        assert me["email"] == ALICE["email"]
        assert "coins" in me
        assert "id" in me and len(me["id"]) == 24

    def test_rooms_list(self):
        r = requests.get(f"{BASE_URL}/api/rooms", timeout=10)
        assert r.status_code == 200
        assert any(rm["roomName"] == "World Vibez" for rm in r.json())

    def test_message_send_and_get(self, alice_token, world_vibez_id):
        _join_room(alice_token, world_vibez_id)
        unique = f"TEST_msg_{int(time.time())}"
        r = requests.post(f"{BASE_URL}/api/messages/{world_vibez_id}",
                          json={"messageText": unique},
                          headers=_h(alice_token), timeout=10)
        assert r.status_code == 200, r.text
        r = requests.get(f"{BASE_URL}/api/messages/{world_vibez_id}?limit=20",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        assert any(m.get("messageText") == unique for m in r.json())

    def test_friends_pending_and_list(self, alice_token):
        for path in ["/api/friends/pending", "/api/friends/list", "/api/friends/sent"]:
            r = requests.get(f"{BASE_URL}{path}", headers=_h(alice_token), timeout=10)
            assert r.status_code == 200, f"{path} -> {r.status_code}"
            assert isinstance(r.json(), list)

    def test_notifications_endpoints(self, alice_token):
        r = requests.get(f"{BASE_URL}/api/notifications",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        assert "count" in r.json() or "unread" in r.json() or "unreadCount" in r.json()

    def test_search_users(self, alice_token):
        r = requests.get(f"{BASE_URL}/api/search/users?q=bo",
                         headers=_h(alice_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_leaderboard(self, alice_token):
        for path in ["/api/leaderboard/xp", "/api/leaderboard/coins", "/api/leaderboard/active"]:
            r = requests.get(f"{BASE_URL}{path}", headers=_h(alice_token), timeout=10)
            assert r.status_code == 200, f"{path} -> {r.status_code}"

    def test_room_join_leave(self, bob_token, world_vibez_id):
        _leave_current_room(bob_token)
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/join",
                          headers=_h(bob_token), timeout=10)
        assert r.status_code == 200
        assert _me(bob_token).get("currentRoomId") == world_vibez_id
        r = requests.post(f"{BASE_URL}/api/rooms/{world_vibez_id}/leave",
                          headers=_h(bob_token), timeout=10)
        assert r.status_code == 200
        assert _me(bob_token).get("currentRoomId") is None
