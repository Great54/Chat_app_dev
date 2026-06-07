"""Backend tests for GenC Vibez — profile redesign + tiered tournament + room-scoped tournaments + private/public.

Covers:
1. Auth: register/login/me
2. Profile card with postsCount/likesCount
3. Friends list privacy (403 for others)
4. Tournament create — public visible to other room members
5. Tournament create — private hidden, has 6-char joinCode
6. Private tournament: join by id forbidden, join by code works
7. Prize split:
   - <=4 players, 1 winner takes 100%
   - 5..10 (size=8), winners=[56,24]
   - >10 (size=11), winners=[44,33,22,11], length=4
8. Tournament visibility constants & room-scoped filter (room A != room B)
"""
import os
import sys
import time
import math
import string
import random
import pytest
import requests

# Load frontend .env to read REACT_APP_BACKEND_URL (pytest env doesn't have it)
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
assert _BURL, "REACT_APP_BACKEND_URL is not set"
BASE_URL = _BURL.rstrip("/")
API = f"{BASE_URL}/api"

# Add backend to path for direct helper imports
sys.path.insert(0, "/app/backend")
import server as srv  # noqa: E402

JOIN_CODE_ALPHABET = set(srv.TOURNAMENT_JOIN_CODE_ALPHABET)


# --------------------------- helpers ---------------------------
def _rand_suffix(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def register(prefix="u"):
    suffix = f"{int(time.time()*1000)}{_rand_suffix(4)}"
    email = f"{prefix}{suffix}@t.com"
    username = f"{prefix}{suffix}"
    payload = {"email": email, "password": "pass1234", "username": username, "displayName": prefix.capitalize()}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    me = requests.get(f"{API}/auth/me", headers=auth(tok), timeout=10)
    assert me.status_code == 200, me.text
    return {"token": tok, "id": me.json()["id"], "email": email, "username": username}


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def init_rooms(tok):
    r = requests.post(f"{API}/init/rooms", headers=auth(tok), timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()


def list_rooms(tok):
    r = requests.get(f"{API}/rooms", headers=auth(tok), timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def join_room(tok, room_id):
    r = requests.post(f"{API}/rooms/{room_id}/join", headers=auth(tok), timeout=10)
    assert r.status_code in (200, 201), f"join_room {room_id}: {r.status_code} {r.text}"
    return r.json()


def get_two_rooms(tok):
    init_rooms(tok)
    rooms = list_rooms(tok)
    assert len(rooms) >= 2, "Need at least 2 rooms for room-scope test"
    return rooms[0]["id"], rooms[1]["id"]


# --------------------------- unit-level helpers ---------------------------
class TestPrizeHelpers:
    def test_winners_count(self):
        assert srv._winners_count(2) == 1
        assert srv._winners_count(3) == 1
        assert srv._winners_count(4) == 1
        assert srv._winners_count(5) == 2
        assert srv._winners_count(8) == 2
        assert srv._winners_count(10) == 2
        # >10 -> max(3, ceil(0.3*n))
        assert srv._winners_count(11) == 4  # ceil(3.3)=4
        assert srv._winners_count(12) == 4  # ceil(3.6)=4
        assert srv._winners_count(16) == 5

    def test_prize_split_le4(self):
        assert srv._prize_split(40, 4) == [40]
        assert srv._prize_split(30, 3) == [30]

    def test_prize_split_5_10(self):
        shares = srv._prize_split(80, 8)
        assert shares == [56, 24]
        assert sum(shares) == 80
        shares10 = srv._prize_split(100, 10)
        assert shares10 == [70, 30]

    def test_prize_split_gt10(self):
        shares = srv._prize_split(110, 11)
        assert len(shares) == 4
        assert shares == [44, 33, 22, 11]
        assert sum(shares) == 110

    def test_visible_hours_constant(self):
        assert srv.TOURNAMENT_VISIBLE_HOURS == 5

    def test_join_code_generator(self):
        for _ in range(20):
            code = srv._generate_join_code()
            assert len(code) == 6
            assert all(c in JOIN_CODE_ALPHABET for c in code)
            # Forbidden chars
            assert "I" not in code and "O" not in code and "0" not in code and "1" not in code


# --------------------------- shared session fixtures ---------------------------
@pytest.fixture(scope="module")
def alice():
    return register("alice")


@pytest.fixture(scope="module")
def bob():
    return register("bob")


@pytest.fixture(scope="module")
def two_rooms(alice):
    return get_two_rooms(alice["token"])


# --------------------------- auth flow ---------------------------
class TestAuthFlow:
    def test_register_login_me(self):
        # fresh user
        suffix = f"reg{int(time.time()*1000)}{_rand_suffix(4)}"
        email = f"{suffix}@t.com"
        payload = {"email": email, "password": "pass1234", "username": suffix, "displayName": "RegTest"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        tok = r.json()["access_token"]
        assert isinstance(tok, str) and len(tok) > 10

        # login
        lr = requests.post(f"{API}/auth/login", json={"identifier": email, "password": "pass1234"}, timeout=10)
        assert lr.status_code == 200, lr.text
        tok2 = lr.json()["access_token"]

        # /auth/me
        me = requests.get(f"{API}/auth/me", headers=auth(tok2), timeout=10)
        assert me.status_code == 200, me.text
        body = me.json()
        assert body["email"] == email
        assert body["username"] == suffix


# --------------------------- profile card ---------------------------
class TestProfileCard:
    def test_fresh_user_counts_zero(self, alice, bob):
        r = requests.get(f"{API}/users/{alice['id']}/profile-card", headers=auth(bob["token"]), timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["id"] == alice["id"]
        assert "postsCount" in body and "likesCount" in body
        # Alice has not yet posted at this stage (executed first)
        # but other tests may also use alice, so just verify keys present & numeric.
        assert isinstance(body["postsCount"], int)
        assert isinstance(body["likesCount"], int)
        # Badges include label key (might be empty if no vipTier)
        assert isinstance(body["badges"], list)


# --------------------------- friends privacy ---------------------------
class TestFriendsPrivacy:
    def test_self_can_see(self, alice):
        r = requests.get(f"{API}/users/{alice['id']}/friends", headers=auth(alice["token"]), timeout=10)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_others_get_403(self, alice, bob):
        r = requests.get(f"{API}/users/{alice['id']}/friends", headers=auth(bob["token"]), timeout=10)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        assert "private" in r.json().get("detail", "").lower()


# --------------------------- posts/likes counts ---------------------------
class TestPostsLikesCounts:
    def test_post_and_like_counts(self, alice, bob, two_rooms):
        room_a, _ = two_rooms
        join_room(alice["token"], room_a)
        join_room(bob["token"], room_a)

        # Alice creates a post
        r = requests.post(
            f"{API}/rooms/{room_a}/posts",
            headers=auth(alice["token"]),
            json={"text": "hello world TEST"},
            timeout=10,
        )
        assert r.status_code in (200, 201), r.text
        post = r.json()
        post_id = post.get("id") or post.get("_id")
        assert post_id

        # Bob views Alice's profile-card → postsCount >= 1
        pc = requests.get(f"{API}/users/{alice['id']}/profile-card", headers=auth(bob["token"]), timeout=10).json()
        assert pc["postsCount"] >= 1

        # Bob likes the post
        lk = requests.post(f"{API}/posts/{post_id}/like", headers=auth(bob["token"]), timeout=10)
        assert lk.status_code == 200, lk.text
        assert lk.json().get("liked") is True
        assert lk.json().get("likesCount", 0) >= 1

        # Now Alice's likesCount >= 1
        pc2 = requests.get(f"{API}/users/{alice['id']}/profile-card", headers=auth(bob["token"]), timeout=10).json()
        assert pc2["likesCount"] >= 1


# --------------------------- tournament create public ---------------------------
class TestTournamentPublic:
    def test_public_visible_to_other(self, alice, bob, two_rooms):
        room_a, _ = two_rooms
        # ensure both joined room_a
        join_room(alice["token"], room_a)
        join_room(bob["token"], room_a)

        r = requests.post(
            f"{API}/rooms/{room_a}/tournaments",
            headers=auth(alice["token"]),
            json={"gameType": "card_higher", "size": 4, "entryFee": 10, "isPrivate": False},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        t = r.json()
        assert t["isPrivate"] is False
        assert t["joinCode"] in (None, "")

        # Bob lists tournaments in room_a → should see this tournament
        ls = requests.get(f"{API}/rooms/{room_a}/tournaments", headers=auth(bob["token"]), timeout=10)
        assert ls.status_code == 200, ls.text
        ids = [x["id"] for x in ls.json()]
        assert t["id"] in ids


# --------------------------- tournament private ---------------------------
class TestTournamentPrivate:
    def test_private_hidden_and_join_by_code(self, alice, bob, two_rooms):
        room_a, _ = two_rooms
        join_room(alice["token"], room_a)
        join_room(bob["token"], room_a)

        r = requests.post(
            f"{API}/rooms/{room_a}/tournaments",
            headers=auth(alice["token"]),
            json={"gameType": "dice_roll", "size": 2, "entryFee": 10, "isPrivate": True},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        t = r.json()
        tid = t["id"]
        code = t["joinCode"]
        assert t["isPrivate"] is True
        assert isinstance(code, str) and len(code) == 6
        assert all(c in JOIN_CODE_ALPHABET for c in code)

        # Bob (non-creator, non-joined) should NOT see this in list
        ls = requests.get(f"{API}/rooms/{room_a}/tournaments", headers=auth(bob["token"]), timeout=10).json()
        ids = [x["id"] for x in ls]
        assert tid not in ids, "Private tournament must be hidden from non-participants"

        # Bob tries to join by id → 403 with mention of "private"
        bad = requests.post(f"{API}/tournaments/{tid}/join", headers=auth(bob["token"]), timeout=10)
        assert bad.status_code == 403, f"Expected 403, got {bad.status_code} {bad.text}"
        assert "private" in bad.json().get("detail", "").lower()

        # Bob joins by code → succeeds; size=2 should auto-complete
        ok = requests.post(
            f"{API}/tournaments/join-by-code",
            headers=auth(bob["token"]),
            json={"code": code},
            timeout=15,
        )
        assert ok.status_code == 200, ok.text
        result = ok.json()
        assert result["joinCode"] == code  # Bob is a participant now → can see code
        assert result["status"] == "completed"
        winners = result["winners"]
        assert len(winners) == 1
        assert winners[0]["coinsWon"] == 20

        # Bob now sees the tournament in list
        ls2 = requests.get(f"{API}/rooms/{room_a}/tournaments", headers=auth(bob["token"]), timeout=10).json()
        ids2 = [x["id"] for x in ls2]
        assert tid in ids2


# --------------------------- prize split: <=4 ---------------------------
class TestPrize_LE4:
    def test_three_players_one_winner_full_pot(self, alice, bob, two_rooms):
        room_a, _ = two_rooms
        # need a 3rd participant
        carol = register("carol")
        join_room(alice["token"], room_a)
        join_room(bob["token"], room_a)
        join_room(carol["token"], room_a)

        # create size=4 (≤4 tier → 1 winner)
        r = requests.post(
            f"{API}/rooms/{room_a}/tournaments",
            headers=auth(alice["token"]),
            json={"gameType": "card_higher", "size": 4, "entryFee": 10, "isPrivate": False},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        t = r.json()
        tid = t["id"]

        # Bob and Carol join (creator = Alice already first player → 3 players total)
        for u in (bob, carol):
            jr = requests.post(f"{API}/tournaments/{tid}/join", headers=auth(u["token"]), timeout=10)
            assert jr.status_code == 200, jr.text

        # Manually start with 3 players (size=4 not filled)
        st = requests.post(f"{API}/tournaments/{tid}/start", headers=auth(alice["token"]), timeout=20)
        assert st.status_code == 200, st.text
        body = st.json()
        assert body["status"] == "completed"
        winners = body["winners"]
        assert len(winners) == 1, f"Expected 1 winner for ≤4 players, got {len(winners)}"
        assert winners[0]["coinsWon"] == 30  # 3 × 10
        assert body["pot"] == 30


# --------------------------- prize split: 5..10 ---------------------------
class TestPrize_5_10:
    def test_eight_players_70_30(self, alice, two_rooms):
        room_a, _ = two_rooms
        join_room(alice["token"], room_a)

        # need 7 more users
        extras = [register(f"p{i}") for i in range(7)]
        for u in extras:
            join_room(u["token"], room_a)

        r = requests.post(
            f"{API}/rooms/{room_a}/tournaments",
            headers=auth(alice["token"]),
            json={"gameType": "card_higher", "size": 8, "entryFee": 10, "isPrivate": False},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        t = r.json()
        tid = t["id"]

        for u in extras:
            jr = requests.post(f"{API}/tournaments/{tid}/join", headers=auth(u["token"]), timeout=15)
            assert jr.status_code == 200, f"join failed for {u['username']}: {jr.text}"
        # last joiner triggers auto-complete; refetch via Alice
        # find tournament in list
        ls = requests.get(f"{API}/rooms/{room_a}/tournaments", headers=auth(alice["token"]), timeout=10).json()
        found = [x for x in ls if x["id"] == tid]
        assert found, "tournament missing from list"
        body = found[0]
        assert body["status"] == "completed"
        assert body["pot"] == 80
        winners = body["winners"]
        assert len(winners) == 2
        assert winners[0]["coinsWon"] == 56
        assert winners[1]["coinsWon"] == 24
        assert sum(w["coinsWon"] for w in winners) == 80


# --------------------------- prize split: >10 ---------------------------
class TestPrize_GT10:
    def test_eleven_players(self, alice, two_rooms):
        room_a, _ = two_rooms
        join_room(alice["token"], room_a)

        extras = [register(f"q{i}") for i in range(10)]
        for u in extras:
            join_room(u["token"], room_a)

        r = requests.post(
            f"{API}/rooms/{room_a}/tournaments",
            headers=auth(alice["token"]),
            json={"gameType": "card_higher", "size": 11, "entryFee": 10, "isPrivate": False},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        t = r.json()
        tid = t["id"]

        for u in extras:
            jr = requests.post(f"{API}/tournaments/{tid}/join", headers=auth(u["token"]), timeout=15)
            assert jr.status_code == 200, f"join failed for {u['username']}: {jr.text}"

        ls = requests.get(f"{API}/rooms/{room_a}/tournaments", headers=auth(alice["token"]), timeout=10).json()
        found = [x for x in ls if x["id"] == tid]
        assert found, "tournament missing from list"
        body = found[0]
        assert body["status"] == "completed"
        assert body["pot"] == 110
        winners = body["winners"]
        assert len(winners) == 4, f"Expected 4 winners for 11 players, got {len(winners)}"
        coins = [w["coinsWon"] for w in winners]
        assert coins == [44, 33, 22, 11]
        assert sum(coins) == 110


# --------------------------- room-scoped tournaments ---------------------------
class TestRoomScoped:
    def test_tournament_not_in_other_room(self, alice, bob, two_rooms):
        room_a, room_b = two_rooms
        join_room(alice["token"], room_a)

        r = requests.post(
            f"{API}/rooms/{room_a}/tournaments",
            headers=auth(alice["token"]),
            json={"gameType": "card_higher", "size": 4, "entryFee": 10, "isPrivate": False},
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]

        # Bob moves to room_b and lists
        join_room(bob["token"], room_b)
        ls_b = requests.get(f"{API}/rooms/{room_b}/tournaments", headers=auth(bob["token"]), timeout=10).json()
        ids_b = [x["id"] for x in ls_b]
        assert tid not in ids_b, "tournament from room A leaked into room B"
