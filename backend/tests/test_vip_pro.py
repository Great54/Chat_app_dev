"""Backend tests for VIP Pro customization endpoints.

Covers:
- GET /api/vip-pro/catalog
- GET /api/vip-pro/settings (auth)
- PUT /api/vip-pro/settings (auth + tier gating + validation)
- POST /api/auth/login monthly grant (2000 coins, every 30 days)
- GET/POST /api/messages/{roomId} enriched fields
- GET /api/users/{userId}/profile-card enriched fields
- GET /api/rooms/{roomId}/members enriched fields
- GET /api/messages/direct/{userId} enriched fields
"""
import os
import uuid
import time
from datetime import datetime, timedelta

import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient

BASE_URL = os.environ.get("BACKEND_BASE_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "vip_pro_app")

VIP_PRO_EMAIL = "vippro@test.com"
VIP_PRO_USERNAME = "vippro"
VIP_PRO_PASSWORD = "Test123!"
ROOM_ID = "6a250fb3887fc39328a98cd4"


# ----------------------------- helpers -----------------------------

@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, identifier, password):
    r = api.post(
        f"{API}/auth/login",
        json={"identifier": identifier, "password": password},
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def vip_token(api):
    return _login(api, VIP_PRO_EMAIL, VIP_PRO_PASSWORD)


@pytest.fixture(scope="session")
def vip_user_id(api, vip_token):
    r = api.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {vip_token}"})
    if r.status_code != 200:
        # fallback to credential-known id
        return "6a250eb3b01b44bc01fb812c"
    return r.json().get("id") or r.json().get("_id") or "6a250eb3b01b44bc01fb812c"


@pytest.fixture(scope="session")
def free_user(api, mongo):
    """A freshly registered (non-VIP) user."""
    uid_suffix = uuid.uuid4().hex[:8]
    email = f"TEST_free_{uid_suffix}@example.com"
    username = f"TESTfree{uid_suffix}"
    password = "Test123!"
    r = api.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": password,
            "username": username,
            "displayName": "Test Free",
        },
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    # find user id in DB
    udoc = mongo.users.find_one({"email": email})
    assert udoc is not None
    yield {
        "id": str(udoc["_id"]),
        "email": email,
        "username": username,
        "password": password,
        "token": token,
    }
    # Cleanup
    mongo.users.delete_one({"_id": udoc["_id"]})


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ----------------------------- 1) Catalog -----------------------------

class TestVipProCatalog:
    def test_catalog_structure(self, api):
        r = api.get(f"{API}/vip-pro/catalog")
        assert r.status_code == 200
        data = r.json()
        # 32 badges
        assert "badges" in data and isinstance(data["badges"], list)
        assert len(data["badges"]) == 32, f"expected 32 badges, got {len(data['badges'])}"
        for b in data["badges"]:
            assert "id" in b and "label" in b
        # 5 auras (none + 4)
        assert "auras" in data and isinstance(data["auras"], list)
        assert len(data["auras"]) == 5
        aura_ids = {a["id"] for a in data["auras"]}
        assert {"none", "glow", "sparkle", "frame", "smoke"}.issubset(aura_ids)
        # Color palettes
        assert "colors" in data
        for key in ("chat", "username", "aura", "pmBox"):
            assert key in data["colors"]
            assert isinstance(data["colors"][key], list)
            assert len(data["colors"][key]) > 0
        # monthly grant info
        assert data["monthlyCoins"] == 2000
        assert data["grantIntervalDays"] == 30


# ----------------------------- 2) Settings GET -----------------------------

class TestVipProSettingsGet:
    def test_settings_requires_auth(self, api):
        r = api.get(f"{API}/vip-pro/settings")
        assert r.status_code in (401, 403)

    def test_fresh_user_settings_are_null(self, api, free_user):
        r = api.get(f"{API}/vip-pro/settings", headers=_auth(free_user["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        # fresh user: no customization
        assert data.get("vipBadgeId") is None
        assert data.get("auraType") is None
        assert data.get("auraColor") is None
        assert data.get("chatColor") is None
        assert data.get("usernameColor") is None
        assert data.get("pmBoxColor") is None
        assert data.get("enlargedAvatar") is False
        # monthly meta present
        assert data["monthlyCoins"] == 2000

    def test_vip_user_settings_includes_grant_meta(self, api, vip_token):
        r = api.get(f"{API}/vip-pro/settings", headers=_auth(vip_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["vipTier"] in ("pro", "elite")
        assert data["monthlyCoins"] == 2000
        assert "nextGrantInDays" in data
        assert "vipProMonthlyGrantAt" in data


# ----------------------------- 3) Settings PUT -----------------------------

class TestVipProSettingsPut:
    def test_put_rejects_non_vip(self, api, free_user):
        r = api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(free_user["token"]),
            json={"vipBadgeId": "badge_crown"},
        )
        assert r.status_code == 403
        assert "VIP Pro" in r.json().get("detail", "")

    def test_put_invalid_badge(self, api, vip_token):
        r = api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={"vipBadgeId": "badge_does_not_exist"},
        )
        assert r.status_code == 400
        assert "badge" in r.json().get("detail", "").lower()

    def test_put_invalid_aura_type(self, api, vip_token):
        r = api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={"auraType": "rainbow"},
        )
        assert r.status_code == 400
        assert "aura" in r.json().get("detail", "").lower()

    def test_put_invalid_color(self, api, vip_token):
        r = api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={"chatColor": "red"},
        )
        assert r.status_code == 400
        assert "color" in r.json().get("detail", "").lower()

    def test_put_full_customization_and_persistence(self, api, vip_token):
        payload = {
            "vipBadgeId": "badge_crown",
            "auraType": "glow",
            "auraColor": "#FF6B35",
            "chatColor": "#FACC15",
            "usernameColor": "#FFD700",
            "pmBoxColor": "#FBCFE8",
            "enlargedAvatar": True,
        }
        r = api.put(f"{API}/vip-pro/settings", headers=_auth(vip_token), json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        # The endpoint returns UserProfile
        assert body["vipBadgeId"] == "badge_crown"
        assert body["auraType"] == "glow"
        assert body["auraColor"] == "#FF6B35"
        assert body["chatColor"] == "#FACC15"
        assert body["usernameColor"] == "#FFD700"
        assert body["pmBoxColor"] == "#FBCFE8"
        assert body["enlargedAvatar"] is True

        # GET to verify persistence
        g = api.get(f"{API}/vip-pro/settings", headers=_auth(vip_token))
        assert g.status_code == 200
        data = g.json()
        assert data["vipBadgeId"] == "badge_crown"
        assert data["auraType"] == "glow"
        assert data["auraColor"] == "#FF6B35"
        assert data["chatColor"] == "#FACC15"
        assert data["usernameColor"] == "#FFD700"
        assert data["pmBoxColor"] == "#FBCFE8"
        assert data["enlargedAvatar"] is True

    def test_put_empty_string_clears_badge_and_aura(self, api, vip_token):
        # First, set values
        api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={"vipBadgeId": "badge_skull", "auraType": "sparkle"},
        )
        # Clear them
        r = api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={"vipBadgeId": "", "auraType": ""},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["vipBadgeId"] is None
        assert body["auraType"] is None


# ----------------------------- 4) Monthly grant on login -----------------------------

class TestVipProMonthlyGrant:
    def test_login_grants_after_30_days(self, api, mongo):
        """Force last grant > 30 days ago, login, verify +2000 coins and grant updated."""
        user = mongo.users.find_one({"email": VIP_PRO_EMAIL})
        assert user is not None, "VIP Pro test user missing"
        assert user.get("vipTier") in ("pro", "elite"), "VIP Pro user lost tier"
        starting_coins = user.get("coins", 0)

        # Force last grant 35 days ago
        old = datetime.utcnow() - timedelta(days=35)
        mongo.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"vipProMonthlyGrantAt": old}},
        )

        # Login
        tok = _login(api, VIP_PRO_EMAIL, VIP_PRO_PASSWORD)
        # Small wait — login awaits the grant, so should be applied already
        u_after = mongo.users.find_one({"_id": user["_id"]})
        coins_after = u_after.get("coins", 0)
        assert coins_after == starting_coins + 2000, (
            f"expected {starting_coins + 2000}, got {coins_after}"
        )
        grant_at_after = u_after.get("vipProMonthlyGrantAt")
        assert grant_at_after is not None
        # Should be updated to ~now
        assert (datetime.utcnow() - grant_at_after).total_seconds() < 60

        # Second login same day: NO new grant
        _login(api, VIP_PRO_EMAIL, VIP_PRO_PASSWORD)
        u_after2 = mongo.users.find_one({"_id": user["_id"]})
        assert u_after2.get("coins", 0) == coins_after, (
            "second same-day login should not grant again"
        )


# ----------------------------- 5) Messages enriched -----------------------------

class TestMessagesEnriched:
    def test_send_and_get_messages_enriched(self, api, vip_token, mongo):
        # ensure user is in room
        user = mongo.users.find_one({"email": VIP_PRO_EMAIL})
        mongo.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"currentRoomId": ROOM_ID}},
        )
        # Set known customization
        api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={
                "vipBadgeId": "badge_crown",
                "auraType": "frame",
                "auraColor": "#FF6B35",
                "chatColor": "#FACC15",
                "usernameColor": "#FFD700",
                "enlargedAvatar": True,
            },
        )

        text = f"TEST_msg_{uuid.uuid4().hex[:6]}"
        r = api.post(
            f"{API}/messages/{ROOM_ID}",
            headers=_auth(vip_token),
            json={"messageText": text},
        )
        assert r.status_code == 200, r.text
        msg = r.json()
        for key in (
            "senderVipTier",
            "senderVipBadgeId",
            "senderAuraType",
            "senderAuraColor",
            "senderChatColor",
            "senderUsernameColor",
            "senderEnlargedAvatar",
        ):
            assert key in msg, f"missing {key} in POST response"
        assert msg["senderVipBadgeId"] == "badge_crown"
        assert msg["senderAuraType"] == "frame"
        assert msg["senderAuraColor"] == "#FF6B35"
        assert msg["senderChatColor"] == "#FACC15"
        assert msg["senderUsernameColor"] == "#FFD700"
        assert msg["senderEnlargedAvatar"] is True
        assert msg["senderVipTier"] in ("pro", "elite")

        # GET messages should also include enriched fields
        g = api.get(f"{API}/messages/{ROOM_ID}")
        assert g.status_code == 200
        msgs = g.json()
        assert len(msgs) > 0
        # find our just-sent message
        ours = [m for m in msgs if m.get("messageText") == text]
        assert ours, "sent message not returned in GET"
        m0 = ours[-1]
        for key in (
            "senderVipTier",
            "senderVipBadgeId",
            "senderAuraType",
            "senderAuraColor",
            "senderChatColor",
            "senderUsernameColor",
            "senderEnlargedAvatar",
        ):
            assert key in m0
        assert m0["senderVipBadgeId"] == "badge_crown"
        assert m0["senderAuraType"] == "frame"


# ----------------------------- 6) Profile card -----------------------------

class TestProfileCard:
    def test_profile_card_has_customization_fields(self, api, vip_token, mongo):
        user = mongo.users.find_one({"email": VIP_PRO_EMAIL})
        uid = str(user["_id"])
        r = api.get(f"{API}/users/{uid}/profile-card", headers=_auth(vip_token))
        assert r.status_code == 200, r.text
        data = r.json()
        for key in (
            "vipBadgeId",
            "auraType",
            "auraColor",
            "chatColor",
            "usernameColor",
            "pmBoxColor",
            "enlargedAvatar",
        ):
            assert key in data, f"profile-card missing {key}"


# ----------------------------- 7) Room members enriched -----------------------------

class TestRoomMembersEnriched:
    def test_members_enriched(self, api, vip_token, mongo):
        # Ensure VIP user joined room
        user = mongo.users.find_one({"email": VIP_PRO_EMAIL})
        # Add to room_members if missing
        existing = mongo.room_members.find_one(
            {"roomId": ROOM_ID, "userId": str(user["_id"])}
        )
        if not existing:
            mongo.room_members.insert_one({
                "roomId": ROOM_ID,
                "userId": str(user["_id"]),
                "username": user["username"],
                "profilePhoto": user.get("photoUrl"),
                "onlineStatus": True,
                "joinedAt": datetime.utcnow(),
            })
        r = api.get(f"{API}/rooms/{ROOM_ID}/members")
        assert r.status_code == 200, r.text
        members = r.json()
        assert isinstance(members, list)
        # find our VIP user
        me_uid = str(user["_id"])
        mine = [m for m in members if m.get("userId") == me_uid]
        assert mine, f"VIP user not present in members list ({len(members)} members)"
        m = mine[0]
        for key in (
            "vipTier",
            "vipBadgeId",
            "auraType",
            "auraColor",
            "usernameColor",
            "enlargedAvatar",
        ):
            assert key in m, f"members entry missing {key}"
        assert m["vipTier"] in ("pro", "elite")


# ----------------------------- 8) Direct messages enriched -----------------------------

class TestDirectMessagesEnriched:
    def test_direct_messages_enriched(self, api, vip_token, free_user, mongo):
        # Set customization on VIP user
        api.put(
            f"{API}/vip-pro/settings",
            headers=_auth(vip_token),
            json={
                "chatColor": "#A3E635",
                "usernameColor": "#FFD700",
                "pmBoxColor": "#FBCFE8",
            },
        )
        # vip -> free
        r1 = api.post(
            f"{API}/messages/direct/send",
            headers=_auth(vip_token),
            json={
                "receiverId": free_user["id"],
                "messageText": f"TEST_dm_vip_{uuid.uuid4().hex[:6]}",
            },
        )
        assert r1.status_code == 200, r1.text
        # free -> vip
        r2 = api.post(
            f"{API}/messages/direct/send",
            headers=_auth(free_user["token"]),
            json={
                "receiverId": str(
                    mongo.users.find_one({"email": VIP_PRO_EMAIL})["_id"]
                ),
                "messageText": f"TEST_dm_free_{uuid.uuid4().hex[:6]}",
            },
        )
        assert r2.status_code == 200, r2.text

        # GET as VIP -- conversation with free user
        r = api.get(
            f"{API}/messages/direct/{free_user['id']}",
            headers=_auth(vip_token),
        )
        assert r.status_code == 200, r.text
        msgs = r.json()
        assert len(msgs) >= 2
        vip_uid = str(mongo.users.find_one({"email": VIP_PRO_EMAIL})["_id"])
        for m in msgs:
            for k in ("senderPmBoxColor", "senderChatColor", "senderUsernameColor"):
                assert k in m, f"DM missing {k}"
            if m["senderId"] == vip_uid:
                # VIP's customization
                assert m["senderPmBoxColor"] == "#FBCFE8"
                assert m["senderChatColor"] == "#A3E635"
                assert m["senderUsernameColor"] == "#FFD700"
            else:
                # Free user has no customization
                assert m["senderPmBoxColor"] is None
                assert m["senderChatColor"] is None
                assert m["senderUsernameColor"] is None
