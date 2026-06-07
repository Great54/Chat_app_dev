"""
Tests for the default-avatar feature:
- 9 PNG assets are served at /api/static/avatars/default-{N}-{name}.png
- POST /api/auth/register assigns a random default avatar
- Existing users have been backfilled (no NULL/stale photoUrl)
- GET /api/auth/me returns a default URL for newly-registered users
"""

import os
import re
import time
import uuid

import pytest
import requests

BASE_URL = "https://75beb0e6-c9fa-4ff7-90aa-c71b219fbffb.preview.emergentagent.com"

DEFAULT_AVATARS = [
    "default-1-panda.png",
    "default-2-corgi.png",
    "default-3-kitten.png",
    "default-4-alien.png",
    "default-5-penguin.png",
    "default-6-bunny.png",
    "default-7-fox.png",
    "default-8-robot.png",
    "default-9-koala.png",
]

DEFAULT_URL_RE = re.compile(
    r"^/api/static/avatars/default-[1-9]-(panda|corgi|kitten|alien|penguin|bunny|fox|robot|koala)\.png$"
)
HTTP_URL_RE = re.compile(r"^https?://")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# -------- STATIC: All 9 default avatars served --------
class TestStaticAvatarsServed:
    @pytest.mark.parametrize("fname", DEFAULT_AVATARS)
    def test_avatar_head_ok(self, session, fname):
        url = f"{BASE_URL}/api/static/avatars/{fname}"
        r = session.get(url, timeout=15)  # use GET — HEAD on static can be 405
        assert r.status_code == 200, f"{fname} -> {r.status_code}"
        ctype = r.headers.get("content-type", "")
        assert "image/png" in ctype, f"{fname} content-type={ctype}"
        # Each PNG should be substantial (>100KB based on actual files ~260KB)
        assert len(r.content) > 100_000, f"{fname} size={len(r.content)}"
        # PNG magic header
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


# -------- FEATURE: register assigns random default avatar --------
class TestRegisterAssignsDefaultAvatar:
    def test_register_10_users_and_check_randomization(self, session):
        suffix = uuid.uuid4().hex[:8]
        seen_urls = set()
        tokens = []
        for i in range(10):
            email = f"TEST_avatar_{suffix}_{i}@test.com"
            username = f"TESTavatar{suffix}{i}"
            payload = {
                "email": email,
                "username": username,
                "password": "TestPass123!",
                "displayName": f"Test Avatar {i}",
            }
            r = session.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
            assert r.status_code == 200, f"register#{i} status={r.status_code} body={r.text[:200]}"
            data = r.json()
            assert "access_token" in data or "token" in data, f"no token in {data}"
            tok = data.get("access_token") or data.get("token")
            tokens.append(tok)

            # GET /api/auth/me to verify photoUrl
            me = session.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {tok}"},
                timeout=15,
            )
            assert me.status_code == 200, f"/auth/me status={me.status_code} body={me.text[:200]}"
            me_data = me.json()
            photo = me_data.get("photoUrl")
            assert photo, f"photoUrl missing for user#{i}: {me_data}"
            assert DEFAULT_URL_RE.match(photo), f"photoUrl doesn't match default pattern: {photo}"
            seen_urls.add(photo)

        # Proves randomization: at least 5 distinct URLs over 10 registrations
        assert len(seen_urls) >= 5, (
            f"Only {len(seen_urls)} distinct default URLs across 10 users (randomization weak): {seen_urls}"
        )


# -------- REGRESSION: existing users backfilled --------
class TestExistingUsersBackfilled:
    def test_avatar_tester_user_has_default(self, session):
        """avatar-tester-1@test.com from request should have a valid default."""
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "avatar-tester-1@test.com", "password": "TestPass123!"},
            timeout=15,
        )
        if r.status_code != 200:
            pytest.skip(f"avatar-tester-1 login failed ({r.status_code}); skipping backfill check")
        tok = r.json().get("access_token") or r.json().get("token")
        me = session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert me.status_code == 200
        photo = me.json().get("photoUrl")
        assert photo, f"avatar-tester-1 has no photoUrl"
        assert DEFAULT_URL_RE.match(photo) or HTTP_URL_RE.match(photo), (
            f"avatar-tester-1 photoUrl invalid: {photo}"
        )

    def test_room_members_all_have_valid_photo(self, session):
        """Existing seeded users (hosttest, scatter1, scatter2 in room 6a258fd574a5efd0f4d3baf5)
        must all have non-null photoUrl matching default-N or http(s)."""
        login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "hosttest1780846544@test.com", "password": "TestPass123!"},
            timeout=15,
        )
        assert login.status_code == 200, f"host login failed: {login.status_code} {login.text[:200]}"
        tok = login.json().get("access_token") or login.json().get("token")
        headers = {"Authorization": f"Bearer {tok}"}

        room_id = "6a258fd574a5efd0f4d3baf5"
        r = session.get(f"{BASE_URL}/api/rooms/{room_id}/members", headers=headers, timeout=15)
        assert r.status_code == 200, f"members status={r.status_code} body={r.text[:200]}"
        members = r.json()
        assert isinstance(members, list) and len(members) >= 1
        bad = []
        for m in members:
            photo = m.get("photoUrl") or m.get("profilePhoto")
            if not photo:
                bad.append((m.get("username") or m.get("userId"), "NULL"))
                continue
            if not (DEFAULT_URL_RE.match(photo) or HTTP_URL_RE.match(photo)):
                bad.append((m.get("username") or m.get("userId"), photo))
        assert not bad, f"Members with invalid photoUrl: {bad}"

    def test_no_stale_default_filenames(self, session):
        """Ensure no member has a stale filename like default-2-shiba.png (old set)."""
        login = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": "hosttest1780846544@test.com", "password": "TestPass123!"},
            timeout=15,
        )
        if login.status_code != 200:
            pytest.skip("host login unavailable")
        tok = login.json().get("access_token") or login.json().get("token")
        headers = {"Authorization": f"Bearer {tok}"}
        r = session.get(
            f"{BASE_URL}/api/rooms/6a258fd574a5efd0f4d3baf5/members",
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 200
        stale_names = {"shiba", "cat", "dog", "owl", "frog", "hamster"}
        for m in r.json():
            photo = (m.get("photoUrl") or m.get("profilePhoto") or "")
            for s in stale_names:
                assert s not in photo.lower(), f"Stale name '{s}' in {photo}"


# -------- Verify served avatar matches a registered user's photoUrl --------
class TestRegisteredUserAvatarServedCorrectly:
    def test_new_user_avatar_resolves_to_real_png(self, session):
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "email": f"TEST_resolve_{suffix}@test.com",
            "username": f"TESTresolve{suffix}",
            "password": "TestPass123!",
            "displayName": "Resolve Test",
        }
        r = session.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        assert r.status_code == 200
        tok = r.json().get("access_token") or r.json().get("token")
        me = session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        ).json()
        photo = me["photoUrl"]
        # photo is a relative URL like /api/static/avatars/default-X-name.png
        full = f"{BASE_URL}{photo}"
        img = session.get(full, timeout=15)
        assert img.status_code == 200
        assert "image/png" in img.headers.get("content-type", "")
        assert img.content[:8] == b"\x89PNG\r\n\x1a\n"
        assert len(img.content) > 100_000
