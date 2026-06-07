"""
Backend tests for the DM + Auto-Join feature set (iteration_10).

Covers:
  - POST /api/rooms/auto-join  (new user → World Vibez, resume on subsequent calls)
  - GET  /api/messages/direct/unread/total  (count + mark-as-read)
  - DELETE /api/messages/direct/conversation/{user_id}
  - GET / PUT /api/users/me/dm-settings  (defaults + persistence)
  - POST /api/rooms/{id}/join + /leave  (currentRoomId / lastRoomId)
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- helpers ----------
def _register(prefix: str = "TEST_dm_") -> dict:
    """Create a fresh user, return {token, user_id, username, headers}."""
    u = f"{prefix}{uuid.uuid4().hex[:10]}"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": f"{u}@test.com",
            "password": "pass1234",
            "username": u,
            "displayName": u,
        },
        timeout=15,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    me = requests.get(f"{API}/auth/me", headers=headers, timeout=10)
    assert me.status_code == 200, me.text
    return {
        "token": token,
        "headers": headers,
        "user_id": me.json()["id"],
        "username": u,
    }


def _login(identifier: str, password: str = "pass1234") -> dict:
    r = requests.post(
        f"{API}/auth/login",
        json={"identifier": identifier, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    me = requests.get(f"{API}/auth/me", headers=headers, timeout=10).json()
    return {"token": token, "headers": headers, "user_id": me["id"], "username": me["username"]}


# ============================================================
# Auto-join
# ============================================================
class TestAutoJoin:
    def test_new_user_goes_to_world_vibez_then_resumes(self):
        u = _register()
        r1 = requests.post(f"{API}/rooms/auto-join", headers=u["headers"], timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["roomName"] == "World Vibez", f"expected World Vibez, got {d1}"
        assert d1["wasResumed"] is False
        assert isinstance(d1["roomId"], str) and len(d1["roomId"]) > 0

        # Second call should resume the same room with wasResumed=True
        r2 = requests.post(f"{API}/rooms/auto-join", headers=u["headers"], timeout=15)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["roomId"] == d1["roomId"]
        assert d2["wasResumed"] is True

    def test_join_then_leave_preserves_lastRoomId(self):
        u = _register()
        # Auto-join first to pick up a real room id
        aj = requests.post(f"{API}/rooms/auto-join", headers=u["headers"], timeout=15).json()
        room_id = aj["roomId"]

        # Leave
        rl = requests.post(f"{API}/rooms/{room_id}/leave", headers=u["headers"], timeout=15)
        assert rl.status_code == 200, rl.text

        # currentRoomId should be cleared, lastRoomId preserved
        me = requests.get(f"{API}/auth/me", headers=u["headers"], timeout=10).json()
        assert me.get("currentRoomId") in (None, ""), f"currentRoomId not cleared: {me}"

        # Auto-join again => should resume same room (lastRoomId preserved)
        aj2 = requests.post(f"{API}/rooms/auto-join", headers=u["headers"], timeout=15).json()
        assert aj2["roomId"] == room_id, f"expected resume of {room_id}, got {aj2}"
        assert aj2["wasResumed"] is True

    def test_explicit_join_sets_currentRoomId(self):
        u = _register()
        # Get a room id via auto-join
        aj = requests.post(f"{API}/rooms/auto-join", headers=u["headers"], timeout=15).json()
        room_id = aj["roomId"]
        # Leave then explicit join
        requests.post(f"{API}/rooms/{room_id}/leave", headers=u["headers"], timeout=15)
        rj = requests.post(f"{API}/rooms/{room_id}/join", headers=u["headers"], timeout=15)
        assert rj.status_code == 200, rj.text
        me = requests.get(f"{API}/auth/me", headers=u["headers"], timeout=10).json()
        assert me.get("currentRoomId") == room_id


# ============================================================
# DM unread counter
# ============================================================
class TestDmUnread:
    def test_unread_count_increments_and_marks_read_on_fetch(self):
        a = _register("TEST_dmA_")
        b = _register("TEST_dmB_")

        # Initially zero for B
        r0 = requests.get(f"{API}/messages/direct/unread/total", headers=b["headers"], timeout=10)
        assert r0.status_code == 200
        base = r0.json()["unreadCount"]
        assert isinstance(base, int)

        # A sends 2 DMs to B
        for i in range(2):
            s = requests.post(
                f"{API}/messages/direct/send",
                headers=a["headers"],
                json={"receiverId": b["user_id"], "messageText": f"hello {i}"},
                timeout=15,
            )
            assert s.status_code == 200, s.text

        r1 = requests.get(f"{API}/messages/direct/unread/total", headers=b["headers"], timeout=10)
        assert r1.status_code == 200
        assert r1.json()["unreadCount"] == base + 2, r1.json()

        # B fetches conversation with A => should mark as read
        rc = requests.get(f"{API}/messages/direct/{a['user_id']}", headers=b["headers"], timeout=10)
        assert rc.status_code == 200
        assert isinstance(rc.json(), list)
        assert len(rc.json()) >= 2

        r2 = requests.get(f"{API}/messages/direct/unread/total", headers=b["headers"], timeout=10)
        assert r2.json()["unreadCount"] == base, r2.json()


# ============================================================
# Delete DM conversation
# ============================================================
class TestDmDelete:
    def test_delete_conversation_removes_all_rows(self):
        a = _register("TEST_dmDelA_")
        b = _register("TEST_dmDelB_")

        # Send 3 messages both directions
        for txt in ["a1", "a2", "a3"]:
            requests.post(
                f"{API}/messages/direct/send",
                headers=a["headers"],
                json={"receiverId": b["user_id"], "messageText": txt},
                timeout=15,
            )
        requests.post(
            f"{API}/messages/direct/send",
            headers=b["headers"],
            json={"receiverId": a["user_id"], "messageText": "b1"},
            timeout=15,
        )

        # Confirm conversation has 4 messages
        conv = requests.get(f"{API}/messages/direct/{b['user_id']}", headers=a["headers"], timeout=10).json()
        assert len(conv) == 4

        # Delete from A side
        d = requests.delete(
            f"{API}/messages/direct/conversation/{b['user_id']}",
            headers=a["headers"],
            timeout=15,
        )
        assert d.status_code == 200, d.text
        body = d.json()
        assert "deleted" in body
        assert body["deleted"] == 4, body

        # Now both sides should see empty
        conv_a = requests.get(f"{API}/messages/direct/{b['user_id']}", headers=a["headers"], timeout=10).json()
        conv_b = requests.get(f"{API}/messages/direct/{a['user_id']}", headers=b["headers"], timeout=10).json()
        assert conv_a == []
        assert conv_b == []


# ============================================================
# DM settings
# ============================================================
class TestDmSettings:
    def test_defaults_and_persistence(self):
        u = _register("TEST_dmSet_")

        # GET defaults
        r = requests.get(f"{API}/users/me/dm-settings", headers=u["headers"], timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["allowMessagesFrom"] == "everyone"
        assert d["notificationsEnabled"] is True

        # PUT update
        upd = requests.put(
            f"{API}/users/me/dm-settings",
            headers=u["headers"],
            json={"allowMessagesFrom": "friends", "notificationsEnabled": False},
            timeout=10,
        )
        assert upd.status_code == 200, upd.text

        # GET back
        r2 = requests.get(f"{API}/users/me/dm-settings", headers=u["headers"], timeout=10).json()
        assert r2["allowMessagesFrom"] == "friends"
        assert r2["notificationsEnabled"] is False

        # PUT nobody
        requests.put(
            f"{API}/users/me/dm-settings",
            headers=u["headers"],
            json={"allowMessagesFrom": "nobody"},
            timeout=10,
        )
        r3 = requests.get(f"{API}/users/me/dm-settings", headers=u["headers"], timeout=10).json()
        assert r3["allowMessagesFrom"] == "nobody"
        # notificationsEnabled untouched by partial PUT
        assert r3["notificationsEnabled"] is False

    def test_invalid_value_is_ignored(self):
        u = _register("TEST_dmSetInv_")
        # GET baseline
        baseline = requests.get(f"{API}/users/me/dm-settings", headers=u["headers"], timeout=10).json()
        # Invalid value should be silently ignored (current contract returns ok)
        bad = requests.put(
            f"{API}/users/me/dm-settings",
            headers=u["headers"],
            json={"allowMessagesFrom": "aliens"},
            timeout=10,
        )
        # Endpoint accepts and ignores invalid value
        assert bad.status_code == 200
        after = requests.get(f"{API}/users/me/dm-settings", headers=u["headers"], timeout=10).json()
        assert after["allowMessagesFrom"] == baseline["allowMessagesFrom"]


# ============================================================
# Seeded users smoke test
# ============================================================
class TestSeededUsersAvailable:
    def test_dmtest1_and_dmtest2_login(self):
        a = _login("dmtest1", "pass1234")
        b = _login("dmtest2", "pass1234")
        assert a["user_id"] and b["user_id"]
        # exchange a DM and ensure no error
        s = requests.post(
            f"{API}/messages/direct/send",
            headers=b["headers"],
            json={"receiverId": a["user_id"], "messageText": f"smoke {uuid.uuid4().hex[:6]}"},
            timeout=15,
        )
        assert s.status_code == 200, s.text
