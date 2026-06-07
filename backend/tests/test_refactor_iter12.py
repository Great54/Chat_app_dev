"""Iteration 12 — tests for the server.py → routes/* refactor.

Covers:
1. GET /api/tournaments/wins/leaderboard — new endpoint, schema, route-ordering
   (must NOT be intercepted by GET /api/tournaments/{tid}).
2. After a real 2-player tournament with Alice vs Bob, the winner's `me` block
   shows wins>=1 and the leaderboard array contains them.
3. GET /api/vip/tiers (now in routes/vip.py) returns the tier list.
4. GET /api/leaderboard/vip (now in routes/leaderboard.py) returns 200 with a list
   even when there are no VIP users.
"""
import os
import time
import random
import string
import pytest
import requests


def _load_env():
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_env()
_BURL = os.environ.get("REACT_APP_BACKEND_URL")
assert _BURL, "REACT_APP_BACKEND_URL not set"
BASE_URL = _BURL.rstrip("/")
API = f"{BASE_URL}/api"


def _rand(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def register(prefix="u"):
    suffix = f"{int(time.time()*1000)}{_rand(4)}"
    payload = {
        "email": f"{prefix}{suffix}@t.com",
        "password": "pass1234",
        "username": f"{prefix}{suffix}",
        "displayName": prefix.capitalize(),
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"register: {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    me = requests.get(f"{API}/auth/me", headers=_auth(tok), timeout=10)
    assert me.status_code == 200, me.text
    return {"token": tok, "id": me.json()["id"]}


def init_rooms(tok):
    r = requests.post(f"{API}/init/rooms", headers=_auth(tok), timeout=15)
    assert r.status_code in (200, 201), r.text


def first_room(tok):
    init_rooms(tok)
    r = requests.get(f"{API}/rooms", headers=_auth(tok), timeout=10)
    assert r.status_code == 200, r.text
    rooms = r.json()
    assert rooms, "no rooms seeded"
    return rooms[0]["id"]


def join_room(tok, rid):
    r = requests.post(f"{API}/rooms/{rid}/join", headers=_auth(tok), timeout=10)
    assert r.status_code in (200, 201), r.text


@pytest.fixture(scope="module")
def alice():
    return register("a12")


@pytest.fixture(scope="module")
def bob():
    return register("b12")


@pytest.fixture(scope="module")
def room(alice):
    return first_room(alice["token"])


# -------------------- 1. new leaderboard endpoint shape --------------------
class TestWinsLeaderboardShape:
    def test_fresh_user_empty_me(self):
        """Fresh user — no #1 finishes → me.wins=0, me.coinsWon=0, me.rank=None."""
        u = register("fresh12")
        r = requests.get(f"{API}/tournaments/wins/leaderboard?limit=10", headers=_auth(u["token"]), timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["windowDays"] == 30
        assert isinstance(body["leaderboard"], list)
        assert isinstance(body["me"], dict)
        me = body["me"]
        assert me["userId"] == u["id"]
        assert me["wins"] == 0
        assert me["coinsWon"] == 0
        assert me["rank"] is None
        # Each row in leaderboard (if any) has expected fields
        for row in body["leaderboard"]:
            assert {"rank", "userId", "displayName", "wins", "coinsWon"}.issubset(row.keys())
            assert "photoUrl" in row  # may be None
            assert isinstance(row["rank"], int)
            assert isinstance(row["wins"], int)

    def test_route_ordering_not_intercepted_by_tid(self):
        """GET /tournaments/wins/leaderboard must NOT be intercepted by GET /tournaments/{tid}.
        Confirm: the path returns leaderboard JSON shape (not 404 Tournament not found)."""
        u = register("ord12")
        r = requests.get(f"{API}/tournaments/wins/leaderboard?limit=5", headers=_auth(u["token"]), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # If it were intercepted, we'd see {"detail": "Tournament not found"}
        assert "windowDays" in body and "leaderboard" in body and "me" in body
        assert "detail" not in body


# -------------------- 2. leaderboard reflects actual #1 finish --------------------
class TestWinsLeaderboardCorrectness:
    def test_after_2p_tournament_winner_appears(self, alice, bob, room):
        join_room(alice["token"], room)
        join_room(bob["token"], room)

        # Create a public 2-player tournament
        cr = requests.post(
            f"{API}/rooms/{room}/tournaments",
            headers=_auth(alice["token"]),
            json={"gameType": "dice_roll", "size": 2, "entryFee": 10, "isPrivate": False},
            timeout=15,
        )
        assert cr.status_code in (200, 201), cr.text
        tid = cr.json()["id"]

        # Bob joins → triggers auto-complete (size=2)
        jr = requests.post(f"{API}/tournaments/{tid}/join", headers=_auth(bob["token"]), timeout=20)
        assert jr.status_code == 200, jr.text
        body = jr.json()
        assert body["status"] == "completed"
        winners = body["winners"]
        assert len(winners) == 1, f"≤4 tier → 1 winner; got {len(winners)}"
        winner_user_id = winners[0]["userId"]
        assert winner_user_id in (alice["id"], bob["id"])

        # Query leaderboard as the winner
        winner_token = alice["token"] if winner_user_id == alice["id"] else bob["token"]
        r = requests.get(f"{API}/tournaments/wins/leaderboard?limit=20", headers=_auth(winner_token), timeout=15)
        assert r.status_code == 200, r.text
        lb = r.json()
        # me should have at least 1 win
        assert lb["me"]["wins"] >= 1, f"expected me.wins >= 1, got {lb['me']}"
        assert lb["me"]["coinsWon"] >= 20, f"expected coinsWon >= 20, got {lb['me']['coinsWon']}"
        assert isinstance(lb["me"]["rank"], int) and lb["me"]["rank"] >= 1
        # leaderboard contains winner
        ids = [row["userId"] for row in lb["leaderboard"]]
        assert winner_user_id in ids


# -------------------- 3. VIP module still works --------------------
class TestVipModule:
    def test_vip_tiers(self, alice):
        r = requests.get(f"{API}/vip/tiers", headers=_auth(alice["token"]), timeout=10)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        # Expect a list of tiers (or dict with tiers key)
        if isinstance(data, dict) and "tiers" in data:
            tiers = data["tiers"]
        else:
            tiers = data
        assert isinstance(tiers, list)
        assert len(tiers) >= 1
        # Each tier should be a dict with some fields
        for t in tiers:
            assert isinstance(t, dict)


# -------------------- 4. Leaderboard module still works --------------------
class TestLeaderboardModule:
    def test_vip_leaderboard_200(self, alice):
        r = requests.get(f"{API}/leaderboard/vip", headers=_auth(alice["token"]), timeout=10)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        # Accept list directly or wrapped
        if isinstance(data, dict):
            # Could be {"leaderboard": [...]} or similar; just confirm it's well-shaped
            assert any(isinstance(v, list) for v in data.values())
        else:
            assert isinstance(data, list)


# -------------------- 5. tournament regression smoke (post-refactor) --------------------
class TestPostRefactorTournamentSmoke:
    """One small smoke that confirms the moved routes are still mounted at the same URLs."""

    def test_get_specific_tournament_404(self, alice):
        # 24-char fake ObjectId
        fake = "0" * 24
        r = requests.get(f"{API}/tournaments/{fake}", headers=_auth(alice["token"]), timeout=10)
        # Should be 404 with proper error detail (not 500)
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text}"
        assert "not found" in r.json().get("detail", "").lower()
