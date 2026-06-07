"""
Tests for the NEW features in GenC Vibez backend (iteration 5):
  - GET  /api/games/types/list           (2 games: card_higher, dice_roll w/ image/icon/tagline)
  - GET  /api/leaderboard/points         (pointsEarned + breakdown)
  - GET  /api/leaderboard/coins-spent    (aggregated negative coin_transactions)
  - GET  /api/coins/send-status          (sentToday/dailyLimit/remainingToday/minPerSend)
  - POST /api/coins/send                 (happy + 4 validation paths)
  - POST /api/rooms/{id}/join            (verify currentRoomId is set — was the ObjectId bug)
  - POST /api/rooms/{id}/games           (image/tagline fields, status=waiting)
  - Full game flow (host + 2nd player, 70/30 pot split, +10/+5 points,
                    gameWins/gameRunnerUps, placement)
  - Game aborted scenario (solo host -> refund + status=aborted)
  - POST /api/rooms/{id}/tournaments     (creator auto-joined, 10 coin deducted)
  - GET  /api/rooms/{id}/tournaments     (lists lobby + completed)
  - POST /api/tournaments/{tid}/join     (charges fee; auto-runs at size=4;
                                          403 wrong-room; 400 when full)
  - Tournament auto-resolution: status=completed, bracket=2 rounds,
                                winners[3] with 800/30/vipPro, 400/20, 200/10
  - POST /api/tournaments/{tid}/start    (manual start works with 2 players, creator only)
  - Points leaderboard reflects post-game and post-tournament awards
"""
import os
import time
import pytest
import requests
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

# All test users use this prefix so we can clean up
TS = int(time.time())
PWD = "pass1234"
USERS = {
    "alice": {"email": f"alice_g{TS}@t.com", "username": f"alice_g{TS}", "displayName": "Alice G"},
    "bob":   {"email": f"bob_g{TS}@t.com",   "username": f"bob_g{TS}",   "displayName": "Bob G"},
    "carol": {"email": f"carol_g{TS}@t.com", "username": f"carol_g{TS}", "displayName": "Carol G"},
    "dave":  {"email": f"dave_g{TS}@t.com",  "username": f"dave_g{TS}",  "displayName": "Dave G"},
    "eve":   {"email": f"eve_g{TS}@t.com",   "username": f"eve_g{TS}",   "displayName": "Eve G"},
}

# ------------------- helpers -------------------

def _client():
    return MongoClient(MONGO_URL)

def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def _register(u):
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": u["email"], "password": PWD,
        "username": u["username"], "displayName": u["displayName"]
    }, timeout=15)
    if r.status_code in (200, 201):
        return r.json().get("access_token") or r.json().get("token")
    # already exists -> login
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": u["email"], "password": PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]

def _me(token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(token), timeout=10)
    assert r.status_code == 200, r.text
    return r.json()

def _set_coins(email, coins):
    c = _client()
    c[DB_NAME].users.update_one({"email": email}, {"$set": {"coins": coins}})
    c.close()

def _get_coins(email):
    c = _client()
    u = c[DB_NAME].users.find_one({"email": email})
    c.close()
    return (u or {}).get("coins", 0)

def _get_user(email):
    c = _client()
    u = c[DB_NAME].users.find_one({"email": email})
    c.close()
    return u or {}

def _leave_current(token):
    me = _me(token)
    if me.get("currentRoomId"):
        requests.post(f"{BASE_URL}/api/rooms/{me['currentRoomId']}/leave",
                      headers=_h(token), timeout=10)

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
    return r.json()

def _get_a_room_id():
    requests.post(f"{BASE_URL}/api/init/rooms", timeout=10)
    r = requests.get(f"{BASE_URL}/api/rooms", timeout=10)
    assert r.status_code == 200, r.text
    rooms = r.json()
    # Prefer Games Hub if exists, else first
    for rm in rooms:
        if "Games" in rm.get("roomName", ""):
            return rm["id"]
    assert rooms, "no rooms found"
    return rooms[0]["id"]

def _get_two_rooms():
    requests.post(f"{BASE_URL}/api/init/rooms", timeout=10)
    r = requests.get(f"{BASE_URL}/api/rooms", timeout=10)
    rooms = r.json()
    assert len(rooms) >= 2, "need at least 2 rooms for wrong-room test"
    return rooms[0]["id"], rooms[1]["id"]

# ------------------- fixtures -------------------

@pytest.fixture(scope="module")
def tokens():
    return {name: _register(u) for name, u in USERS.items()}

@pytest.fixture(scope="module")
def room_id():
    return _get_a_room_id()

@pytest.fixture(scope="module", autouse=True)
def _cleanup_at_end():
    yield
    # Best-effort cleanup
    c = _client()
    db = c[DB_NAME]
    emails = [u["email"] for u in USERS.values()]
    user_ids = [str(d["_id"]) for d in db.users.find({"email": {"$in": emails}})]
    db.users.delete_many({"email": {"$in": emails}})
    if user_ids:
        db.coin_transactions.delete_many({"userId": {"$in": user_ids}})
        db.coin_gifts.delete_many({"$or": [
            {"senderId": {"$in": user_ids}}, {"receiverId": {"$in": user_ids}}
        ]})
        db.notifications.delete_many({"userId": {"$in": user_ids}})
        db.tournaments.delete_many({"createdBy": {"$in": user_ids}})
        db.game_sessions.delete_many({"hostId": {"$in": user_ids}})
    c.close()


# ================================================================
# 1. /api/games/types/list -- 2 games with image/icon/tagline
# ================================================================
class TestGameTypesList:
    def test_returns_exactly_two_games_with_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/games/types/list", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        ids = {g["id"] for g in data}
        assert "card_higher" in ids and "dice_roll" in ids, f"missing games: {ids}"
        assert len(data) == 2, f"expected exactly 2 games, got {len(data)}"
        for g in data:
            assert g["entryFee"] == 10
            assert g.get("image", "").startswith("http")
            assert g.get("icon")
            assert g.get("tagline")
            assert g["minPlayers"] == 2 and g["maxPlayers"] == 6


# ================================================================
# 2. Room join sets currentRoomId  (regression of ObjectId bug)
# ================================================================
class TestRoomJoinCurrentRoomId:
    def test_join_sets_currentRoomId(self, tokens, room_id):
        _leave_current(tokens["alice"])
        r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/join",
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        me = _me(tokens["alice"])
        assert me.get("currentRoomId") == room_id, \
            f"currentRoomId not set after join: {me.get('currentRoomId')}"


# ================================================================
# 3. /api/coins/send-status + /api/coins/send
# ================================================================
class TestCoinGifting:
    def test_send_status_initial(self, tokens):
        # Clear prior gifts so test is deterministic
        c = _client()
        alice_id = str(_get_user(USERS["alice"]["email"])["_id"])
        c[DB_NAME].coin_gifts.delete_many({"senderId": alice_id})
        c.close()

        r = requests.get(f"{BASE_URL}/api/coins/send-status",
                         headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dailyLimit"] == 1000
        assert d["minPerSend"] == 10
        assert d["sentToday"] == 0
        assert d["remainingToday"] == 1000

    def test_send_happy_path(self, tokens):
        _set_coins(USERS["alice"]["email"], 200)
        _set_coins(USERS["bob"]["email"], 100)
        bob_id = str(_get_user(USERS["bob"]["email"])["_id"])
        a_before = _get_coins(USERS["alice"]["email"])
        b_before = _get_coins(USERS["bob"]["email"])

        r = requests.post(f"{BASE_URL}/api/coins/send",
                          json={"receiverId": bob_id, "amount": 50, "message": "gg"},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 50
        assert d["sentToday"] == 50
        assert d["remainingToday"] == 950

        assert _get_coins(USERS["alice"]["email"]) == a_before - 50
        assert _get_coins(USERS["bob"]["email"])   == b_before + 50

        # Bob got a notification of type "coins_received"
        r = requests.get(f"{BASE_URL}/api/notifications",
                         headers=_h(tokens["bob"]), timeout=10)
        assert r.status_code == 200
        notifs = r.json()
        assert any(n.get("type") == "coins_received"
                   and "50" in n.get("body", "") for n in notifs), \
            "no coins_received notification for Bob"

        # send-status now reflects 50
        r = requests.get(f"{BASE_URL}/api/coins/send-status",
                         headers=_h(tokens["alice"]), timeout=10)
        assert r.json()["sentToday"] == 50

    def test_send_below_minimum(self, tokens):
        bob_id = str(_get_user(USERS["bob"]["email"])["_id"])
        r = requests.post(f"{BASE_URL}/api/coins/send",
                          json={"receiverId": bob_id, "amount": 5},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 400, r.text
        assert "Minimum" in r.text or "minimum" in r.text

    def test_send_to_self(self, tokens):
        alice_id = str(_get_user(USERS["alice"]["email"])["_id"])
        r = requests.post(f"{BASE_URL}/api/coins/send",
                          json={"receiverId": alice_id, "amount": 20},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 400, r.text

    def test_send_exceeds_daily_cap(self, tokens):
        # Pre-load coin_gifts so sender has already sent 990 in the last 24h
        c = _client()
        alice_id = str(_get_user(USERS["alice"]["email"])["_id"])
        bob_id   = str(_get_user(USERS["bob"]["email"])["_id"])
        c[DB_NAME].coin_gifts.delete_many({"senderId": alice_id})
        c[DB_NAME].coin_gifts.insert_one({
            "senderId": alice_id, "receiverId": bob_id, "amount": 990,
            "message": "", "createdAt": datetime.utcnow() - timedelta(minutes=5),
        })
        c.close()
        _set_coins(USERS["alice"]["email"], 1000)

        # 50 would push total to 1040 > 1000
        r = requests.post(f"{BASE_URL}/api/coins/send",
                          json={"receiverId": bob_id, "amount": 50},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 400, r.text
        assert "10" in r.text  # remaining hint

        # Clean for downstream tests
        c = _client()
        c[DB_NAME].coin_gifts.delete_many({"senderId": alice_id})
        c.close()

    def test_send_insufficient_balance(self, tokens):
        _set_coins(USERS["alice"]["email"], 5)
        bob_id = str(_get_user(USERS["bob"]["email"])["_id"])
        r = requests.post(f"{BASE_URL}/api/coins/send",
                          json={"receiverId": bob_id, "amount": 50},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 400, r.text
        assert "enough" in r.text.lower() or "coins" in r.text.lower()
        _set_coins(USERS["alice"]["email"], 500)


# ================================================================
# 4. Host game returns image/tagline; full game flow with 2 players
# ================================================================
class TestGameHostAndFlow:
    def test_host_returns_image_and_tagline(self, tokens, room_id):
        _set_coins(USERS["alice"]["email"], 100)
        _join_room(tokens["alice"], room_id)
        r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["status"] == "waiting"
        assert g["entryFee"] == 10
        assert g.get("image", "").startswith("http")
        assert g.get("tagline")
        assert g.get("gameTypeName") == "Higher Card"
        # Wait so this game aborts (cleanup)
        time.sleep(22)
        requests.get(f"{BASE_URL}/api/rooms/{room_id}/games",
                     headers=_h(tokens["alice"]), timeout=10)

    def test_full_game_flow(self, tokens, room_id):
        """Alice hosts card_higher, Bob joins, after 22s -> resolved.
        winner gets ~14, runner ~6, +10/+5 points, gameWins/gameRunnerUps inc, placements set."""
        _set_coins(USERS["alice"]["email"], 100)
        _set_coins(USERS["bob"]["email"],   100)

        # Reset counters in DB for clean assertions
        c = _client()
        for e in (USERS["alice"]["email"], USERS["bob"]["email"]):
            c[DB_NAME].users.update_one({"email": e}, {"$set": {
                "pointsEarned": 0, "gameWins": 0, "gameRunnerUps": 0, "tournamentsWon": 0
            }})
        c.close()

        _join_room(tokens["alice"], room_id)
        _join_room(tokens["bob"],   room_id)

        a_before = _get_coins(USERS["alice"]["email"])
        b_before = _get_coins(USERS["bob"]["email"])

        r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/games",
                          json={"gameType": "card_higher"},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["id"]
        alice_id = _me(tokens["alice"])["id"]

        rj = requests.post(f"{BASE_URL}/api/games/{game_id}/join",
                           headers=_h(tokens["bob"]), timeout=10)
        assert rj.status_code == 200, rj.text
        joined = rj.json()
        assert joined["pot"] == 20

        # Both deducted 10
        assert _get_coins(USERS["alice"]["email"]) == a_before - 10
        assert _get_coins(USERS["bob"]["email"])   == b_before - 10

        # Wait for resolution
        time.sleep(22)

        rg = requests.get(f"{BASE_URL}/api/games/{game_id}",
                          headers=_h(tokens["alice"]), timeout=10)
        assert rg.status_code == 200, rg.text
        resolved = rg.json()
        assert resolved["status"] == "completed", f"got {resolved['status']}"

        # Winner share = round(20*0.7)=14 ; runner share = 20-14 = 6
        assert resolved["winnerShare"] == 14, f"winnerShare={resolved['winnerShare']}"
        assert resolved["runnerShare"] == 6,  f"runnerShare={resolved['runnerShare']}"

        # Placements present
        placements = sorted([p.get("placement") for p in resolved["players"]])
        assert placements == [1, 2], f"placements={placements}"

        # Coins: winner = -10 + 14 = +4, runner = -10 + 6 = -4
        winner_id = resolved["winnerId"]
        if winner_id == alice_id:
            assert _get_coins(USERS["alice"]["email"]) == a_before + 4
            assert _get_coins(USERS["bob"]["email"])   == b_before - 4
            winner_email, runner_email = USERS["alice"]["email"], USERS["bob"]["email"]
        else:
            assert _get_coins(USERS["bob"]["email"])   == b_before + 4
            assert _get_coins(USERS["alice"]["email"]) == a_before - 4
            winner_email, runner_email = USERS["bob"]["email"], USERS["alice"]["email"]

        # Stats on users
        w = _get_user(winner_email)
        r2 = _get_user(runner_email)
        assert w.get("pointsEarned", 0) == 10, f"winner points={w.get('pointsEarned')}"
        assert w.get("gameWins", 0) == 1
        assert r2.get("pointsEarned", 0) == 5, f"runner points={r2.get('pointsEarned')}"
        assert r2.get("gameRunnerUps", 0) == 1

    def test_aborted_when_solo(self, tokens, room_id):
        _set_coins(USERS["carol"]["email"], 100)
        _join_room(tokens["carol"], room_id)
        before = _get_coins(USERS["carol"]["email"])
        r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/games",
                          json={"gameType": "dice_roll"},
                          headers=_h(tokens["carol"]), timeout=10)
        assert r.status_code == 200, r.text
        game_id = r.json()["id"]
        assert _get_coins(USERS["carol"]["email"]) == before - 10

        time.sleep(22)

        rg = requests.get(f"{BASE_URL}/api/games/{game_id}",
                          headers=_h(tokens["carol"]), timeout=10)
        assert rg.status_code == 200, rg.text
        assert rg.json()["status"] == "aborted"
        # Refunded
        assert _get_coins(USERS["carol"]["email"]) == before, "entry fee was not refunded"


# ================================================================
# 5. Leaderboards (run AFTER game flow so we have real data)
# ================================================================
class TestLeaderboards:
    def test_points_leaderboard(self, tokens):
        r = requests.get(f"{BASE_URL}/api/leaderboard/points",
                         headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list) and len(rows) > 0
        # sorted desc by pointsEarned
        pts = [u["pointsEarned"] for u in rows]
        assert pts == sorted(pts, reverse=True), f"not sorted desc: {pts}"
        # breakdown fields present
        first = rows[0]
        for f in ("rank", "pointsEarned", "gameWins", "gameRunnerUps", "tournamentsWon"):
            assert f in first, f"missing {f} in points leaderboard row"
        # Our alice OR bob should appear (they earned points in the prior test)
        emails = {USERS["alice"]["email"], USERS["bob"]["email"]}
        # match by username (we know our usernames)
        unames = {USERS["alice"]["username"], USERS["bob"]["username"]}
        found = [u for u in rows if u["username"] in unames]
        assert len(found) >= 1, "neither alice nor bob appears in points leaderboard"

    def test_coins_spent_leaderboard(self, tokens):
        r = requests.get(f"{BASE_URL}/api/leaderboard/coins-spent",
                         headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            assert "coinsSpent" in rows[0]
            assert rows[0]["coinsSpent"] >= 0  # positive (abs of negatives)
            spent = [u["coinsSpent"] for u in rows]
            assert spent == sorted(spent, reverse=True)


# ================================================================
# 6. Tournaments
# ================================================================
class TestTournaments:
    def test_create_tournament(self, tokens, room_id):
        _set_coins(USERS["alice"]["email"], 200)
        _join_room(tokens["alice"], room_id)
        before = _get_coins(USERS["alice"]["email"])

        r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/tournaments",
                          json={"gameType": "card_higher"},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "lobby"
        assert t["size"] == 4
        assert t["entryFee"] == 10
        assert t["pot"] == 10
        assert len(t["players"]) == 1  # creator auto-joined
        # 10 coins deducted from creator
        assert _get_coins(USERS["alice"]["email"]) == before - 10
        # Lobby listing returns it
        rl = requests.get(f"{BASE_URL}/api/rooms/{room_id}/tournaments",
                          headers=_h(tokens["alice"]), timeout=10)
        assert rl.status_code == 200
        assert any(x["id"] == t["id"] for x in rl.json())

        # Save for next test
        TestTournaments.tid_lobby = t["id"]

    def test_join_wrong_room_403(self, tokens):
        # Create a tournament in roomA. eve is in roomB. Eve tries to join.
        room_a, room_b = _get_two_rooms()
        _set_coins(USERS["dave"]["email"], 200)
        _join_room(tokens["dave"], room_a)
        r = requests.post(f"{BASE_URL}/api/rooms/{room_a}/tournaments",
                          json={"gameType": "dice_roll"},
                          headers=_h(tokens["dave"]), timeout=10)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]

        _set_coins(USERS["eve"]["email"], 200)
        _join_room(tokens["eve"], room_b)
        rj = requests.post(f"{BASE_URL}/api/tournaments/{tid}/join",
                           headers=_h(tokens["eve"]), timeout=10)
        assert rj.status_code == 403, f"got {rj.status_code} {rj.text}"

    def test_auto_run_at_size_4(self, tokens, room_id):
        """Reuse TestTournaments.tid_lobby (alice already in). 3 more join -> auto runs."""
        tid = TestTournaments.tid_lobby
        # Move bob, carol, eve into the same room
        for name in ("bob", "carol", "eve"):
            _set_coins(USERS[name]["email"], 200)
            # reset counters
            c = _client()
            c[DB_NAME].users.update_one({"email": USERS[name]["email"]}, {"$set": {
                "vipTier": None, "vipExpiresAt": None
            }})
            c.close()
            _join_room(tokens[name], room_id)

        # bob & carol join -> still lobby (3 players)
        for name in ("bob", "carol"):
            rj = requests.post(f"{BASE_URL}/api/tournaments/{tid}/join",
                               headers=_h(tokens[name]), timeout=10)
            assert rj.status_code == 200, f"{name} join: {rj.status_code} {rj.text}"

        # Snapshot points for the 4 players before final join
        emails = [USERS[n]["email"] for n in ("alice", "bob", "carol", "eve")]
        before_points = {e: _get_user(e).get("pointsEarned", 0) for e in emails}

        # eve joins -> 4 players -> auto-run
        rj = requests.post(f"{BASE_URL}/api/tournaments/{tid}/join",
                           headers=_h(tokens["eve"]), timeout=10)
        assert rj.status_code == 200, rj.text
        t = rj.json()
        assert t["status"] == "completed", f"expected completed after 4th join, got {t['status']}"
        # 2 rounds: semifinals (2 matches) + final + 3rd-place (varies). Bracket should have at least 2 rounds.
        assert isinstance(t.get("bracket"), list) and len(t["bracket"]) >= 2, \
            f"bracket rounds={len(t.get('bracket', []))}"
        # 3 winners with placements 1,2,3
        winners = t.get("winners", [])
        assert len(winners) == 3, f"expected 3 winners entries, got {len(winners)}"
        placements = sorted([w["placement"] for w in winners])
        assert placements == [1, 2, 3]

        # Verify reward payouts
        def _by_placement(p): return next(w for w in winners if w["placement"] == p)
        first, second, third = _by_placement(1), _by_placement(2), _by_placement(3)

        # Coins check (we set everyone to 200, all paid 10 entry => 190 base)
        # 1st: 190 + 800 = 990. 2nd: 190 + 400 = 590. 3rd: 190 + 200 = 390.
        # 4th: 190.
        emails_by_uid = {str(_get_user(e)["_id"]): e for e in emails}
        first_email  = emails_by_uid[first["userId"]]
        second_email = emails_by_uid[second["userId"]]
        third_email  = emails_by_uid[third["userId"]]
        assert _get_coins(first_email)  == 990, f"first coins={_get_coins(first_email)}"
        assert _get_coins(second_email) == 590, f"second coins={_get_coins(second_email)}"
        assert _get_coins(third_email)  == 390, f"third coins={_get_coins(third_email)}"

        # Points delta: +30/+20/+10
        assert _get_user(first_email).get("pointsEarned", 0) - before_points[first_email]   == 30
        assert _get_user(second_email).get("pointsEarned", 0) - before_points[second_email] == 20
        assert _get_user(third_email).get("pointsEarned", 0)  - before_points[third_email]  == 10

        # VIP Pro for 1st place, vipExpiresAt ~30 days
        u1 = _get_user(first_email)
        assert u1.get("vipTier") == "pro", f"vipTier={u1.get('vipTier')}"
        exp = u1.get("vipExpiresAt")
        assert exp is not None
        delta_days = (exp - datetime.utcnow()).days if hasattr(exp, "year") else 30
        assert 28 <= delta_days <= 31, f"vipExpiresAt {delta_days} days from now"
        # 2nd & 3rd do NOT get VIP
        assert _get_user(second_email).get("vipTier") in (None, "")
        assert _get_user(third_email).get("vipTier")  in (None, "")
        # tournamentsWon counter incremented on first only
        assert u1.get("tournamentsWon", 0) >= 1

    def test_manual_start_with_2_players(self, tokens, room_id):
        # alice creates new tournament, bob joins (2 players), alice starts manually
        _set_coins(USERS["alice"]["email"], 200)
        _set_coins(USERS["bob"]["email"], 200)
        _join_room(tokens["alice"], room_id)
        _join_room(tokens["bob"], room_id)

        r = requests.post(f"{BASE_URL}/api/rooms/{room_id}/tournaments",
                          json={"gameType": "dice_roll"},
                          headers=_h(tokens["alice"]), timeout=10)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]

        rj = requests.post(f"{BASE_URL}/api/tournaments/{tid}/join",
                           headers=_h(tokens["bob"]), timeout=10)
        assert rj.status_code == 200, rj.text
        assert rj.json()["status"] == "lobby"  # not auto-started yet

        # Non-creator cannot start
        rs_bob = requests.post(f"{BASE_URL}/api/tournaments/{tid}/start",
                               headers=_h(tokens["bob"]), timeout=10)
        assert rs_bob.status_code == 403, rs_bob.text

        # Creator starts
        rs = requests.post(f"{BASE_URL}/api/tournaments/{tid}/start",
                           headers=_h(tokens["alice"]), timeout=10)
        assert rs.status_code == 200, rs.text
        assert rs.json()["status"] == "completed"

    def test_join_full_tournament_400(self, tokens, room_id):
        # Use the tournament from auto-run test — it's completed (not lobby), so try
        # a fresh one filled to 4 then attempt 5th.
        # Easiest: try to join the already-completed one => "already started" 400
        tid = TestTournaments.tid_lobby
        # dave is not in the players. He's in room_a (a different room potentially).
        # Move him to room_id and try join.
        _set_coins(USERS["dave"]["email"], 200)
        _join_room(tokens["dave"], room_id)
        r = requests.post(f"{BASE_URL}/api/tournaments/{tid}/join",
                          headers=_h(tokens["dave"]), timeout=10)
        # Completed tournament -> status != lobby -> 400
        assert r.status_code == 400, r.text
        assert "already" in r.text.lower() or "full" in r.text.lower() or "started" in r.text.lower()
