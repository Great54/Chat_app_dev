"""Iteration 6: dynamic tournament size + dynamic entry fee + 50/50 pot split tests.
Covers in-room game host (custom entryFee/maxPlayers), full game flow, and
tournament create/run with sizes 2/4/5/8/16 + validation + regression endpoints.
"""
import os
import time
import pytest
import requests
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"
PWD = "pass1234"
GAMES_HUB_ID = "6a24ddb620bea231c011020e"
GAME_TIMER_SLEEP = 22  # GAME_TIMER_SECONDS = 20

# Direct mongo for cleanup (avoid room-full errors caused by stale members)
_mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_db_name = os.environ.get("DB_NAME", "genc_vibez")


async def _reset_room_members():
    client = AsyncIOMotorClient(_mongo_url)
    db = client[_db_name]
    await db.room_members.delete_many({"roomId": GAMES_HUB_ID})
    await db.rooms.update_one({"_id": ObjectId(GAMES_HUB_ID)}, {"$set": {"currentUserCount": 0}})
    await db.users.update_many({"currentRoomId": GAMES_HUB_ID}, {"$set": {"currentRoomId": None}})
    client.close()


# ----------------- helpers -----------------
_users_created = []


def _register(prefix: str, coins_needed: int = 0):
    """Register a fresh user. Optionally seed extra coins via DB-free trick:
    run multiple daily-login backdates via mongo not allowed → we'll mint coins
    by gifting from a 'bank' user. For these tests, registration gives 100 coins
    which is enough for fee<=50 single-action. For >100 fees we seed via /coins/send loops not allowed.
    Solution: register multiple users and gift-collect — but simpler: keep entry fees <= 100.
    """
    ts = int(time.time() * 1000)
    email = f"{prefix}{ts}@t.com"
    username = f"{prefix}{ts}"
    r = requests.post(f"{BASE}/auth/register", json={
        "email": email, "password": PWD, "username": username, "displayName": prefix.capitalize(),
    }, timeout=15)
    assert r.status_code == 200, f"register failed: {r.text}"
    tok = r.json()["access_token"]
    me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {tok}"}, timeout=10).json()
    _users_created.append(me["id"])
    return {"id": me["id"], "token": tok, "headers": {"Authorization": f"Bearer {tok}"},
            "email": email, "username": username}


def _seed_rooms():
    requests.post(f"{BASE}/init/rooms", timeout=15)


def _join_hub(u):
    r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/join", headers=u["headers"], timeout=10)
    assert r.status_code == 200, r.text


def _coins(u):
    return requests.get(f"{BASE}/auth/me", headers=u["headers"], timeout=10).json()["coins"]


@pytest.fixture(scope="module", autouse=True)
def setup_module():
    _seed_rooms()
    asyncio.run(_reset_room_members())
    yield
    asyncio.run(_reset_room_members())


@pytest.fixture(autouse=True)
def _reset_each():
    """Reset room membership before each test to avoid Room-full errors."""
    asyncio.run(_reset_room_members())
    yield


# =================== GAME HOST TESTS ===================

class TestGameHostDynamic:
    def test_host_with_custom_fee_and_max(self):
        alice = _register("ghc")
        _join_hub(alice)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=alice["headers"],
                          json={"gameType": "card_higher", "entryFee": 50, "maxPlayers": 4}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["entryFee"] == 50
        assert d["maxPlayers"] == 4
        assert d["pot"] == 50
        assert d["status"] == "waiting"
        assert "winnerShare" in d and "runnerShare" in d

    def test_validation_fee_too_low(self):
        u = _register("gvl")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=u["headers"],
                          json={"gameType": "card_higher", "entryFee": 0}, timeout=10)
        assert r.status_code == 400

    def test_validation_fee_too_high(self):
        u = _register("gvh")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=u["headers"],
                          json={"gameType": "card_higher", "entryFee": 100001}, timeout=10)
        assert r.status_code == 400

    def test_validation_maxplayers_too_low(self):
        u = _register("gvmpl")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=u["headers"],
                          json={"gameType": "card_higher", "maxPlayers": 1}, timeout=10)
        assert r.status_code == 400

    def test_validation_maxplayers_too_high(self):
        u = _register("gvmph")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=u["headers"],
                          json={"gameType": "card_higher", "maxPlayers": 33}, timeout=10)
        assert r.status_code == 400

    def test_insufficient_coins(self):
        u = _register("gvis")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=u["headers"],
                          json={"gameType": "card_higher", "entryFee": 200}, timeout=10)
        assert r.status_code == 400
        assert "200" in r.json()["detail"]

    def test_defaults_fallback(self):
        u = _register("gvdef")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=u["headers"],
                          json={"gameType": "card_higher"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["entryFee"] == 10
        assert d["maxPlayers"] == 6


# =================== GAME FULL FLOW (50/50) ===================

class TestGameFullFlow5050:
    def test_2_player_50coin_5050_split(self):
        alice = _register("g2a")
        bob = _register("g2b")
        _join_hub(alice)
        _join_hub(bob)
        alice_start = _coins(alice)
        bob_start = _coins(bob)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=alice["headers"],
                          json={"gameType": "card_higher", "entryFee": 50}, timeout=10)
        gid = r.json()["id"]
        r2 = requests.post(f"{BASE}/games/{gid}/join", headers=bob["headers"], timeout=10)
        assert r2.status_code == 200
        assert r2.json()["pot"] == 100

        time.sleep(GAME_TIMER_SLEEP)
        final = requests.get(f"{BASE}/games/{gid}", headers=alice["headers"], timeout=10).json()
        assert final["status"] == "completed"
        # 50/50 even split of pot=100 → 50 / 50
        assert final["winnerShare"] == 50
        assert final["runnerShare"] == 50
        assert final["winnerShare"] + final["runnerShare"] == final["pot"]

        # Both end +0 net coins (paid 50, received 50). winner has +10 pts, runner-up +5 pts (not checked here).
        end_alice = _coins(alice)
        end_bob = _coins(bob)
        # net change = -50 entry + share (50 or 50)
        for start, end in [(alice_start, end_alice), (bob_start, end_bob)]:
            assert end - start == 0  # paid 50, got 50 back

    def test_3_player_25coin_odd_pot_split(self):
        a = _register("g3a")
        b = _register("g3b")
        c = _register("g3c")
        for u in (a, b, c):
            _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/games", headers=a["headers"],
                          json={"gameType": "card_higher", "entryFee": 25}, timeout=10)
        gid = r.json()["id"]
        requests.post(f"{BASE}/games/{gid}/join", headers=b["headers"], timeout=10)
        requests.post(f"{BASE}/games/{gid}/join", headers=c["headers"], timeout=10)

        time.sleep(GAME_TIMER_SLEEP)
        final = requests.get(f"{BASE}/games/{gid}", headers=a["headers"], timeout=10).json()
        assert final["status"] == "completed"
        assert final["pot"] == 75
        # 50/50 with odd → winner 38, runner 37
        assert {final["winnerShare"], final["runnerShare"]} == {38, 37}
        assert final["winnerShare"] + final["runnerShare"] == 75


# =================== TOURNAMENT TESTS ===================

class TestTournamentCreate:
    def test_create_dynamic_8_with_fee_25(self):
        u = _register("tcd")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=u["headers"],
                          json={"gameType": "card_higher", "size": 8, "entryFee": 25, "name": "BigTest"}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["size"] == 8
        assert d["entryFee"] == 25
        assert d["pot"] == 25  # only creator
        assert d["name"] == "BigTest"

    def test_defaults_size_and_fee(self):
        u = _register("tdef")
        _join_hub(u)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=u["headers"],
                          json={"gameType": "card_higher"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["size"] == 4
        assert d["entryFee"] == 10

    def test_validation(self):
        u = _register("tv")
        _join_hub(u)
        H = u["headers"]
        # size<2
        assert requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=H,
                             json={"gameType": "card_higher", "size": 1}, timeout=10).status_code == 400
        # size>32
        assert requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=H,
                             json={"gameType": "card_higher", "size": 33}, timeout=10).status_code == 400
        # fee<1
        assert requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=H,
                             json={"gameType": "card_higher", "entryFee": 0}, timeout=10).status_code == 400
        # fee>100000
        assert requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=H,
                             json={"gameType": "card_higher", "entryFee": 100001}, timeout=10).status_code == 400
        # insufficient coins (user has ~80 left after one tournament entry)
        bigfee = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=H,
                               json={"gameType": "card_higher", "entryFee": 9999}, timeout=10)
        assert bigfee.status_code == 400

    def test_non_room_member_403(self):
        u = _register("tnonm")  # NOT joining hub
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=u["headers"],
                          json={"gameType": "card_higher", "size": 4, "entryFee": 5}, timeout=10)
        assert r.status_code == 403


def _make_tournament_with_players(prefix: str, size: int, fee: int = 10, joiners_count: int = None):
    """Create tournament and have `joiners_count` extra players join (default: fill to `size`)."""
    if joiners_count is None:
        joiners_count = size - 1
    creator = _register(f"{prefix}c")
    _join_hub(creator)
    r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=creator["headers"],
                      json={"gameType": "card_higher", "size": size, "entryFee": fee,
                            "name": f"T{prefix}"}, timeout=10)
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    joiners = []
    for i in range(joiners_count):
        j = _register(f"{prefix}j{i}")
        _join_hub(j)
        rj = requests.post(f"{BASE}/tournaments/{tid}/join", headers=j["headers"], timeout=10)
        assert rj.status_code == 200, rj.text
        joiners.append(j)
    final = requests.get(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=creator["headers"],
                         timeout=10).json()
    t = next(t for t in final if t["id"] == tid)
    return creator, joiners, tid, t


class TestTournamentRun:
    def test_8_player_full_flow(self):
        creator, joiners, tid, t = _make_tournament_with_players("t8", 8, fee=5)
        assert t["status"] == "completed"
        assert t["pot"] == 8 * 5
        rounds = [b["round"] for b in t["bracket"]]
        assert "quarterfinal" in rounds
        assert "semifinal" in rounds
        assert "final" in rounds
        assert "third-place" in rounds
        winners = t["winners"]
        assert len(winners) == 3
        placements = [w["placement"] for w in winners]
        assert placements == [1, 2, 3]
        w1, w2, w3 = winners
        assert w1["coinsWon"] + w2["coinsWon"] == t["pot"]
        assert w3["coinsWon"] == 0
        assert w1["pointsEarned"] == 30
        assert w2["pointsEarned"] == 20
        assert w3["pointsEarned"] == 10

    def test_champion_vip_pro(self):
        creator, joiners, tid, t = _make_tournament_with_players("tv", 4, fee=5)
        champ_id = t["winners"][0]["userId"]
        # find token
        champ_token = None
        for u in [creator] + joiners:
            if u["id"] == champ_id:
                champ_token = u["headers"]
                break
        assert champ_token is not None
        prof = requests.get(f"{BASE}/auth/me", headers=champ_token, timeout=10).json()
        assert prof["vipTier"] == "pro"

    def test_2_player_only_final(self):
        creator, joiners, tid, t = _make_tournament_with_players("t2", 2, fee=5)
        assert t["status"] == "completed"
        assert t["pot"] == 10
        rounds = [b["round"] for b in t["bracket"]]
        assert rounds == ["final"]
        assert len(t["winners"]) == 2
        assert t["winners"][0]["coinsWon"] + t["winners"][1]["coinsWon"] == 10

    def test_16_player_flow(self):
        creator, joiners, tid, t = _make_tournament_with_players("t16", 16, fee=5)
        assert t["status"] == "completed"
        assert t["pot"] == 80
        rounds = [b["round"] for b in t["bracket"]]
        assert "round-of-16" in rounds
        assert "quarterfinal" in rounds
        assert "semifinal" in rounds
        assert "final" in rounds
        assert "third-place" in rounds

    def test_odd_size_5_with_byes(self):
        creator, joiners, tid, t = _make_tournament_with_players("t5", 5, fee=5)
        assert t["status"] == "completed"
        assert t["pot"] == 25
        assert len(t["winners"]) == 3
        # has at least one bye match
        has_bye = any(m.get("bye") for b in t["bracket"] for m in b["matches"])
        assert has_bye

    def test_manual_start_underfilled(self):
        creator = _register("tmsc")
        _join_hub(creator)
        r = requests.post(f"{BASE}/rooms/{GAMES_HUB_ID}/tournaments", headers=creator["headers"],
                          json={"gameType": "card_higher", "size": 4, "entryFee": 5,
                                "name": "Manual"}, timeout=10)
        tid = r.json()["id"]
        # one more joiner (total 2)
        j = _register("tmsj")
        _join_hub(j)
        requests.post(f"{BASE}/tournaments/{tid}/join", headers=j["headers"], timeout=10)
        # manual start by creator
        rs = requests.post(f"{BASE}/tournaments/{tid}/start", headers=creator["headers"], timeout=10)
        assert rs.status_code == 200
        d = rs.json()
        assert d["status"] == "completed"
        assert d["pot"] == 10  # 2 * 5

    def test_leaderboard_points_reflects_champion(self):
        creator, joiners, tid, t = _make_tournament_with_players("tlb", 4, fee=5)
        champ_id = t["winners"][0]["userId"]
        lb = requests.get(f"{BASE}/leaderboard/points", timeout=10).json()
        ids = [row.get("userId") or row.get("id") for row in lb]
        assert champ_id in ids, f"champion not in leaderboard: {ids[:5]}"


# =================== REGRESSION ===================

class TestRegression:
    def test_games_types_list(self):
        r = requests.get(f"{BASE}/games/types/list", timeout=10)
        assert r.status_code == 200
        types = r.json()
        ids = [t["id"] for t in types]
        assert "card_higher" in ids
        assert "dice_roll" in ids

    def test_leaderboard_coins_spent(self):
        r = requests.get(f"{BASE}/leaderboard/coins-spent", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_coin_send(self):
        a = _register("csa")
        b = _register("csb")
        r = requests.post(f"{BASE}/coins/send", headers=a["headers"],
                          json={"receiverId": b["id"], "amount": 20, "message": "hi"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("amount") == 20 or "amount" in r.json() or "sent" in r.json().get("message", "").lower()
