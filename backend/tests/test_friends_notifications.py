"""
Backend tests for Friends & Notifications features (GenC Vibez).
Covers: friends/pending, friends/sent, friends/reject, friends/{id} DELETE,
search/users, notifications CRUD, auto-notification generation,
plus regression for existing auth/rooms/leaderboard/friends/request/accept/list.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ALICE = {"email": "alice@test.com", "password": "password123"}
BOB = {"email": "bob@test.com", "password": "password123"}


# ---------- helpers ----------
def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def me(token):
    r = requests.get(f"{API}/auth/me", headers=auth(token), timeout=15)
    assert r.status_code == 200
    return r.json()


def cleanup_friendship(token, other_id):
    # best-effort: remove accepted friendship or pending request
    try:
        requests.delete(f"{API}/friends/{other_id}", headers=auth(token), timeout=10)
    except Exception:
        pass
    # remove any pending requests in either direction
    try:
        pend = requests.get(f"{API}/friends/pending", headers=auth(token), timeout=10).json()
        for p in pend:
            requests.post(f"{API}/friends/reject/{p['requestId']}", headers=auth(token), timeout=10)
        sent = requests.get(f"{API}/friends/sent", headers=auth(token), timeout=10).json()
        for s in sent:
            # rejecting our own sent request from the receiver side isn't possible; ask other side
            pass
    except Exception:
        pass


@pytest.fixture(scope="module")
def tokens():
    a = login(ALICE)
    b = login(BOB)
    # make sure starting state is "no friendship" between alice & bob
    alice_id = me(a)["id"]
    bob_id = me(b)["id"]
    cleanup_friendship(a, bob_id)
    cleanup_friendship(b, alice_id)
    return {"alice": a, "bob": b, "alice_id": alice_id, "bob_id": bob_id}


# ---------- regression: auth ----------
class TestAuthRegression:
    def test_login_alice(self):
        t = login(ALICE)
        assert isinstance(t, str) and len(t) > 20

    def test_me_returns_profile(self, tokens):
        data = me(tokens["alice"])
        assert data["email"] == "alice@test.com"
        assert "id" in data and "_id" not in data


# ---------- search/users ----------
class TestSearchUsers:
    def test_search_short_query_returns_empty(self, tokens):
        r = requests.get(f"{API}/search/users", params={"q": "a"}, headers=auth(tokens["alice"]))
        assert r.status_code == 200
        assert r.json() == []

    def test_search_empty_query_returns_empty(self, tokens):
        r = requests.get(f"{API}/search/users", params={"q": ""}, headers=auth(tokens["alice"]))
        assert r.status_code == 200
        assert r.json() == []

    def test_search_case_insensitive_and_excludes_self(self, tokens):
        r = requests.get(f"{API}/search/users", params={"q": "BoB"}, headers=auth(tokens["alice"]))
        assert r.status_code == 200
        results = r.json()
        usernames = [u["username"] for u in results]
        assert "bob" in usernames
        assert "alice" not in usernames  # excludes self
        for u in results:
            assert "friendStatus" in u
            assert u["friendStatus"] in {"none", "sent", "received", "friends"}
            assert "_id" not in u

    def test_search_requires_auth(self):
        r = requests.get(f"{API}/search/users", params={"q": "bob"})
        assert r.status_code in (401, 403)


# ---------- full friend flow & auto-notifications ----------
class TestFriendFlow:
    def test_01_send_request_creates_notification(self, tokens):
        # Alice sends to Bob
        r = requests.post(
            f"{API}/friends/request",
            json={"receiverId": tokens["bob_id"]},
            headers=auth(tokens["alice"]),
        )
        assert r.status_code == 200, r.text

        # Bob should have a friend_request notification
        r = requests.get(f"{API}/notifications", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        notifs = r.json()
        assert any(n["type"] == "friend_request" for n in notifs), "no friend_request notification created"

    def test_02_search_shows_sent_status(self, tokens):
        r = requests.get(f"{API}/search/users", params={"q": "bob"}, headers=auth(tokens["alice"]))
        bob_entry = next((u for u in r.json() if u["username"] == "bob"), None)
        assert bob_entry is not None
        assert bob_entry["friendStatus"] == "sent"

    def test_03_search_shows_received_status_for_bob(self, tokens):
        r = requests.get(f"{API}/search/users", params={"q": "alice"}, headers=auth(tokens["bob"]))
        alice_entry = next((u for u in r.json() if u["username"] == "alice"), None)
        assert alice_entry is not None
        assert alice_entry["friendStatus"] == "received"

    def test_04_pending_returns_received_request(self, tokens):
        r = requests.get(f"{API}/friends/pending", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        pend = r.json()
        assert len(pend) >= 1
        match = [p for p in pend if p["senderId"] == tokens["alice_id"]]
        assert len(match) == 1
        assert "requestId" in match[0]
        assert match[0]["username"] == "alice"

    def test_05_sent_returns_sent_request(self, tokens):
        r = requests.get(f"{API}/friends/sent", headers=auth(tokens["alice"]))
        assert r.status_code == 200
        sent = r.json()
        match = [s for s in sent if s["receiverId"] == tokens["bob_id"]]
        assert len(match) == 1
        assert match[0]["username"] == "bob"

    def test_06_unauthorized_cannot_reject_others_request(self, tokens):
        # Alice (sender) tries to reject her own request — should be 403 (not the receiver)
        pend = requests.get(f"{API}/friends/pending", headers=auth(tokens["bob"])).json()
        request_id = [p for p in pend if p["senderId"] == tokens["alice_id"]][0]["requestId"]
        r = requests.post(f"{API}/friends/reject/{request_id}", headers=auth(tokens["alice"]))
        assert r.status_code == 403

    def test_07_accept_creates_friend_accepted_notification(self, tokens):
        pend = requests.get(f"{API}/friends/pending", headers=auth(tokens["bob"])).json()
        request_id = [p for p in pend if p["senderId"] == tokens["alice_id"]][0]["requestId"]

        r = requests.post(f"{API}/friends/accept/{request_id}", headers=auth(tokens["bob"]))
        assert r.status_code == 200, r.text

        # Alice should now have friend_accepted notif
        r = requests.get(f"{API}/notifications", headers=auth(tokens["alice"]))
        assert r.status_code == 200
        notifs = r.json()
        assert any(n["type"] == "friend_accepted" for n in notifs), "no friend_accepted notification"

    def test_08_friends_list_shows_both(self, tokens):
        ra = requests.get(f"{API}/friends/list", headers=auth(tokens["alice"])).json()
        rb = requests.get(f"{API}/friends/list", headers=auth(tokens["bob"])).json()
        assert any(f["id"] == tokens["bob_id"] for f in ra)
        assert any(f["id"] == tokens["alice_id"] for f in rb)

    def test_09_search_shows_friends_status(self, tokens):
        r = requests.get(f"{API}/search/users", params={"q": "bob"}, headers=auth(tokens["alice"]))
        bob_entry = next((u for u in r.json() if u["username"] == "bob"), None)
        assert bob_entry is not None
        assert bob_entry["friendStatus"] == "friends"

    def test_10_remove_friend(self, tokens):
        r = requests.delete(f"{API}/friends/{tokens['bob_id']}", headers=auth(tokens["alice"]))
        assert r.status_code == 200, r.text
        # verify gone
        ra = requests.get(f"{API}/friends/list", headers=auth(tokens["alice"])).json()
        assert not any(f["id"] == tokens["bob_id"] for f in ra)

    def test_11_remove_nonexistent_friend_404(self, tokens):
        r = requests.delete(f"{API}/friends/{tokens['bob_id']}", headers=auth(tokens["alice"]))
        assert r.status_code == 404


# ---------- reject flow ----------
class TestRejectFlow:
    def test_reject_removes_request(self, tokens):
        # cleanup first
        cleanup_friendship(tokens["alice"], tokens["bob_id"])
        cleanup_friendship(tokens["bob"], tokens["alice_id"])

        # Alice sends again
        r = requests.post(f"{API}/friends/request",
                          json={"receiverId": tokens["bob_id"]},
                          headers=auth(tokens["alice"]))
        assert r.status_code == 200

        pend = requests.get(f"{API}/friends/pending", headers=auth(tokens["bob"])).json()
        rid = [p for p in pend if p["senderId"] == tokens["alice_id"]][0]["requestId"]

        r = requests.post(f"{API}/friends/reject/{rid}", headers=auth(tokens["bob"]))
        assert r.status_code == 200

        # Verify gone from pending and from sent
        pend2 = requests.get(f"{API}/friends/pending", headers=auth(tokens["bob"])).json()
        assert not any(p["requestId"] == rid for p in pend2)
        sent2 = requests.get(f"{API}/friends/sent", headers=auth(tokens["alice"])).json()
        assert not any(s["requestId"] == rid for s in sent2)

    def test_reject_nonexistent_returns_404(self, tokens):
        fake_id = "507f1f77bcf86cd799439011"
        r = requests.post(f"{API}/friends/reject/{fake_id}", headers=auth(tokens["bob"]))
        assert r.status_code == 404


# ---------- notifications CRUD ----------
class TestNotifications:
    def _ensure_notification(self, tokens):
        """Ensure Bob has at least one notification (send a friend request)."""
        cleanup_friendship(tokens["alice"], tokens["bob_id"])
        cleanup_friendship(tokens["bob"], tokens["alice_id"])
        requests.post(f"{API}/friends/request",
                      json={"receiverId": tokens["bob_id"]},
                      headers=auth(tokens["alice"]))

    def test_list_notifications_structure(self, tokens):
        self._ensure_notification(tokens)
        r = requests.get(f"{API}/notifications", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        notifs = r.json()
        assert len(notifs) >= 1
        n = notifs[0]
        assert {"id", "title", "body", "type", "readStatus", "createdAt"}.issubset(n.keys())
        assert "_id" not in n

    def test_unread_count(self, tokens):
        r = requests.get(f"{API}/notifications/unread-count", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        data = r.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        assert data["count"] >= 1

    def test_mark_single_as_read(self, tokens):
        notifs = requests.get(f"{API}/notifications", headers=auth(tokens["bob"])).json()
        target = next((n for n in notifs if not n["readStatus"]), notifs[0])
        nid = target["id"]
        r = requests.post(f"{API}/notifications/{nid}/read", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        notifs2 = requests.get(f"{API}/notifications", headers=auth(tokens["bob"])).json()
        found = next(n for n in notifs2 if n["id"] == nid)
        assert found["readStatus"] is True

    def test_cannot_mark_others_notification(self, tokens):
        # Bob's notification, Alice tries to mark
        notifs = requests.get(f"{API}/notifications", headers=auth(tokens["bob"])).json()
        if not notifs:
            pytest.skip("no notifications to test cross-user access")
        nid = notifs[0]["id"]
        r = requests.post(f"{API}/notifications/{nid}/read", headers=auth(tokens["alice"]))
        assert r.status_code == 404  # filter by userId yields no match

    def test_mark_all_read(self, tokens):
        # Generate another unread for Bob
        cleanup_friendship(tokens["alice"], tokens["bob_id"])
        cleanup_friendship(tokens["bob"], tokens["alice_id"])
        requests.post(f"{API}/friends/request",
                      json={"receiverId": tokens["bob_id"]},
                      headers=auth(tokens["alice"]))
        r = requests.post(f"{API}/notifications/read-all", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        cnt = requests.get(f"{API}/notifications/unread-count", headers=auth(tokens["bob"])).json()
        assert cnt["count"] == 0

    def test_delete_notification(self, tokens):
        notifs = requests.get(f"{API}/notifications", headers=auth(tokens["bob"])).json()
        if not notifs:
            pytest.skip("no notifications to delete")
        nid = notifs[0]["id"]
        r = requests.delete(f"{API}/notifications/{nid}", headers=auth(tokens["bob"]))
        assert r.status_code == 200
        notifs2 = requests.get(f"{API}/notifications", headers=auth(tokens["bob"])).json()
        assert not any(n["id"] == nid for n in notifs2)

    def test_cannot_delete_others_notification(self, tokens):
        # create a fresh notif for bob then alice tries to delete
        cleanup_friendship(tokens["alice"], tokens["bob_id"])
        cleanup_friendship(tokens["bob"], tokens["alice_id"])
        requests.post(f"{API}/friends/request",
                      json={"receiverId": tokens["bob_id"]},
                      headers=auth(tokens["alice"]))
        notifs = requests.get(f"{API}/notifications", headers=auth(tokens["bob"])).json()
        nid = notifs[0]["id"]
        r = requests.delete(f"{API}/notifications/{nid}", headers=auth(tokens["alice"]))
        assert r.status_code == 404

    def test_delete_nonexistent_returns_404(self, tokens):
        fake = "507f1f77bcf86cd799439011"
        r = requests.delete(f"{API}/notifications/{fake}", headers=auth(tokens["bob"]))
        assert r.status_code == 404


# ---------- spin wheel notification ----------
class TestGameNotification:
    def test_spin_wheel_big_win_creates_notification(self, tokens):
        """Spin until we either trigger a 50+ win (creates 'game' notif) or run out of attempts."""
        # Ensure alice has coins
        prof = me(tokens["alice"])
        if prof["coins"] < 500:
            # top up via daily reward not possible; just attempt limited spins
            pass

        # Clear any prior game notifications
        notifs = requests.get(f"{API}/notifications", headers=auth(tokens["alice"])).json()
        for n in notifs:
            if n["type"] == "game":
                requests.delete(f"{API}/notifications/{n['id']}", headers=auth(tokens["alice"]))

        big_win = False
        attempts = 0
        while attempts < 40:
            prof = me(tokens["alice"])
            if prof["coins"] < 10:
                break
            r = requests.post(f"{API}/games/spin-wheel", headers=auth(tokens["alice"]))
            if r.status_code != 200:
                break
            if r.json().get("reward", 0) >= 50:
                big_win = True
                break
            attempts += 1

        if not big_win:
            pytest.skip(f"could not trigger 50+ spin win in {attempts} attempts (RNG)")

        notifs = requests.get(f"{API}/notifications", headers=auth(tokens["alice"])).json()
        assert any(n["type"] == "game" for n in notifs), "no game notification after 50+ win"


# ---------- regression: rooms, leaderboard ----------
class TestRegression:
    def test_rooms_list(self):
        r = requests.get(f"{API}/rooms")
        assert r.status_code == 200
        rooms = r.json()
        assert isinstance(rooms, list)
        assert len(rooms) >= 1

    def test_leaderboard_xp(self):
        r = requests.get(f"{API}/leaderboard/xp")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_leaderboard_coins(self):
        r = requests.get(f"{API}/leaderboard/coins")
        assert r.status_code == 200

    def test_friends_request_duplicate_rejected(self, tokens):
        cleanup_friendship(tokens["alice"], tokens["bob_id"])
        cleanup_friendship(tokens["bob"], tokens["alice_id"])
        r1 = requests.post(f"{API}/friends/request",
                           json={"receiverId": tokens["bob_id"]},
                           headers=auth(tokens["alice"]))
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/friends/request",
                           json={"receiverId": tokens["bob_id"]},
                           headers=auth(tokens["alice"]))
        assert r2.status_code == 400
        # cleanup
        cleanup_friendship(tokens["bob"], tokens["alice_id"])
