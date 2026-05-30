"""
Backend regression tests for UI feature update (iteration 4).
Verifies that after server.py was restored from git + bannerUrl re-added:
- Auth (register/login/me) still works and bannerUrl is exposed
- Rooms list returns roomBanner populated for default rooms
- PUT /api/users/profile accepts bannerUrl
- Friends/Notifications/Games endpoints still work (smoke)
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / '.env')

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"

ALICE = {"email": "alice@test.com", "password": "password123"}
BOB = {"email": "bob@test.com", "password": "password123"}


@pytest.fixture(scope="session")
def alice_token():
    r = requests.post(f"{API}/auth/login", json=ALICE, timeout=15)
    assert r.status_code == 200, f"Alice login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def bob_token():
    r = requests.post(f"{API}/auth/login", json=BOB, timeout=15)
    assert r.status_code == 200, f"Bob login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------ AUTH ------------------
class TestAuth:
    def test_login_alice(self, alice_token):
        assert isinstance(alice_token, str) and len(alice_token) > 10

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "alice@test.com", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_auth_me_returns_bannerUrl_field(self, alice_token):
        r = requests.get(f"{API}/auth/me", headers=auth(alice_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        # bannerUrl key MUST be present (can be None)
        assert "bannerUrl" in data, f"bannerUrl missing from /auth/me response: {data.keys()}"
        assert "photoUrl" in data
        assert data["email"] == "alice@test.com"

    def test_auth_me_unauthorized(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code in (401, 403)


# ------------------ ROOMS WITH BANNERS ------------------
class TestRoomsBanner:
    def test_rooms_list_has_roomBanner(self):
        r = requests.get(f"{API}/rooms", timeout=10)
        assert r.status_code == 200
        rooms = r.json()
        assert isinstance(rooms, list) and len(rooms) >= 4
        for room in rooms:
            assert "roomBanner" in room, f"roomBanner key missing in room {room.get('roomName')}"
            assert "maxCapacity" in room and room["maxCapacity"] == 36
            assert "currentUserCount" in room

    def test_default_rooms_have_unsplash_banners(self):
        r = requests.get(f"{API}/rooms", timeout=10)
        rooms = r.json()
        with_banner = [r for r in rooms if r.get("roomBanner")]
        assert len(with_banner) >= 4, "Expected at least 4 rooms with Unsplash banners"
        for room in with_banner:
            assert "unsplash" in room["roomBanner"].lower() or room["roomBanner"].startswith("http")


# ------------------ PROFILE UPDATE WITH BANNERURL ------------------
class TestProfileBannerUpdate:
    BANNER_URL = "https://images.unsplash.com/photo-test-banner?w=800"

    def test_update_profile_with_bannerUrl(self, alice_token):
        r = requests.put(f"{API}/users/profile",
                         headers=auth(alice_token),
                         json={"bannerUrl": self.BANNER_URL},
                         timeout=10)
        assert r.status_code == 200, f"PUT profile failed: {r.text}"
        data = r.json()
        assert data["bannerUrl"] == self.BANNER_URL

    def test_get_me_reflects_persisted_banner(self, alice_token):
        # Verify persistence via GET /auth/me
        r = requests.get(f"{API}/auth/me", headers=auth(alice_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["bannerUrl"] == self.BANNER_URL

    def test_update_profile_clears_banner_with_displayName(self, alice_token):
        # Update displayName only, banner should remain
        r = requests.put(f"{API}/users/profile",
                         headers=auth(alice_token),
                         json={"displayName": "Alice Wonder"},
                         timeout=10)
        assert r.status_code == 200
        assert r.json()["bannerUrl"] == self.BANNER_URL  # still there


# ------------------ REGRESSION SMOKE ------------------
class TestRegressionSmoke:
    def test_friends_list(self, alice_token):
        r = requests.get(f"{API}/friends/list", headers=auth(alice_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_friends_pending(self, alice_token):
        r = requests.get(f"{API}/friends/pending", headers=auth(alice_token), timeout=10)
        assert r.status_code == 200

    def test_notifications_list(self, alice_token):
        r = requests.get(f"{API}/notifications", headers=auth(alice_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notifications_unread_count(self, alice_token):
        r = requests.get(f"{API}/notifications/unread-count",
                         headers=auth(alice_token), timeout=10)
        assert r.status_code == 200
        assert "count" in r.json()

    def test_leaderboard_xp(self):
        r = requests.get(f"{API}/leaderboard/xp", timeout=10)
        assert r.status_code == 200

    def test_leaderboard_active_no_500(self):
        # Regression: should not crash on system messages
        r = requests.get(f"{API}/leaderboard/active", timeout=10)
        assert r.status_code == 200

    def test_search_users(self, alice_token):
        r = requests.get(f"{API}/search/users?q=bo",
                         headers=auth(alice_token), timeout=10)
        assert r.status_code == 200

    def test_game_types_list(self):
        r = requests.get(f"{API}/games/types/list", timeout=10)
        assert r.status_code == 200
        types = r.json()
        assert any(t["id"] == "card_higher" for t in types)
        assert any(t["id"] == "dice_roll" for t in types)

    def test_room_members_endpoint(self):
        # Get first room and check members endpoint
        rooms = requests.get(f"{API}/rooms", timeout=10).json()
        room_id = rooms[0]["id"]
        r = requests.get(f"{API}/rooms/{room_id}/members", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_messages_endpoint(self):
        rooms = requests.get(f"{API}/rooms", timeout=10).json()
        room_id = rooms[0]["id"]
        r = requests.get(f"{API}/messages/{room_id}", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------------ HOST + JOIN GAME (regression) ------------------
class TestGameHostJoin:
    def test_host_requires_in_room(self, alice_token):
        # If alice is not in any room, hosting should 403
        # Get current room
        me = requests.get(f"{API}/auth/me", headers=auth(alice_token), timeout=10).json()
        if me.get("currentRoomId"):
            # leave first to ensure 403
            requests.post(f"{API}/rooms/{me['currentRoomId']}/leave",
                          headers=auth(alice_token), timeout=10)
        r = requests.post(f"{API}/rooms/000000000000000000000000/games",
                          headers=auth(alice_token),
                          json={"gameType": "card_higher"}, timeout=10)
        assert r.status_code == 403
