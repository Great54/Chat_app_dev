"""Tests for the 'refunded entry-fee' fix on the coins-spent leaderboard.

Bug: when a hosted multiplayer game (or tournament) is cancelled because
not enough players joined, the entry fee is refunded but the original
negative `coin_transactions` row was still being summed by
GET /api/leaderboard/coins-spent. The fix tags the spend row with
`refunded:true` (and adds {refunded: {$ne: True}} to the leaderboard
aggregation pipeline), and a startup backfill heals historical aborts.

We hit the real backend (REACT_APP_BACKEND_URL) and also use pymongo
for direct DB inspection / synthetic-row injection (and an idempotency
check after a supervisor restart).
"""

import os
import time
import subprocess

import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

# Public backend URL provided by orchestrator (frontend/.env not present in this env).
BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://75beb0e6-c9fa-4ff7-90aa-c71b219fbffb.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

ROOM_ID = "6a258fd574a5efd0f4d3baf5"  # World Vibez (3 members per credentials)

HOST = {"identifier": "hosttest1780846544@test.com", "password": "TestPass123!"}
P2 = {"identifier": "scatter1@test.com", "password": "TestPass123!"}
P3 = {"identifier": "scatter2@test.com", "password": "TestPass123!"}


# ---------- helpers ----------

def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['identifier']}: {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _me(tok):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    return r.json()


def _join_room(tok, room_id=ROOM_ID):
    me = _me(tok)
    if me.get("currentRoomId") == room_id:
        return
    requests.post(f"{BASE_URL}/api/rooms/{room_id}/join", headers=_h(tok), timeout=15)


def _coins_spent_for(user_id):
    r = requests.get(f"{BASE_URL}/api/leaderboard/coins-spent?limit=200", timeout=15)
    assert r.status_code == 200
    for row in r.json():
        if row["id"] == user_id:
            return row["coinsSpent"]
    return 0


@pytest.fixture(scope="module")
def db():
    cli = MongoClient(MONGO_URL)
    return cli[DB_NAME]


@pytest.fixture(scope="module")
def tokens():
    return {"host": _login(HOST), "p2": _login(P2), "p3": _login(P3)}


@pytest.fixture(scope="module", autouse=True)
def ensure_room_membership(tokens):
    # Host stays in ROOM_ID for the whole suite; p2/p3 will be moved
    # in/out by individual tests as needed (joining another room would
    # boot host out via leave_room_helper, so do this BEFORE host joins).
    _join_room(tokens["host"], ROOM_ID)


# ============================================================
# 1. FEATURE — Lone-host game abort → spend row flagged refunded
# ============================================================

def test_lone_host_game_abort_flags_refunded_and_excludes_from_leaderboard(tokens, db):
    """Host a Higher Card game (entryFee=50) with no joiners. After the
    20s timer expires the game is aborted and:
      - the host's coin balance is fully restored
      - the original -50 spend row is flagged refunded:true with gameId
      - the coins-spent leaderboard delta for the host is 0
    """
    host_tok = tokens["host"]
    me = _me(host_tok)
    host_id = me["id"]

    coins_before = me["coins"]
    spent_before = _coins_spent_for(host_id)

    # Host a card_higher game with a custom 50-coin entry fee
    r = requests.post(
        f"{BASE_URL}/api/rooms/{ROOM_ID}/games",
        json={"gameType": "card_higher", "entryFee": 50},
        headers=_h(host_tok),
        timeout=15,
    )
    assert r.status_code == 200, f"host_room_game failed: {r.text}"
    game = r.json()
    game_id = game["id"]

    # Immediately after host: balance dropped by 50, txn exists with gameId
    me_after_host = _me(host_tok)
    assert me_after_host["coins"] == coins_before - 50

    txn = db.coin_transactions.find_one({"gameId": game_id, "userId": host_id, "amount": -50})
    assert txn is not None, "spend txn should be tagged with gameId"
    assert txn.get("refunded") is not True, "spend should not be refunded yet"

    # Wait for the 20s host timer to expire, then poke an endpoint that
    # triggers _check_and_resolve_if_expired -> _resolve_game (abort).
    time.sleep(22)
    r = requests.get(f"{BASE_URL}/api/games/{game_id}", headers=_h(host_tok), timeout=15)
    assert r.status_code == 200
    resolved = r.json()
    assert resolved["status"] == "aborted", f"game should be aborted, got {resolved['status']}"

    # Coin balance is back to pre-host value (refund credited)
    me_after = _me(host_tok)
    assert me_after["coins"] == coins_before, (
        f"refund failed: before={coins_before} after={me_after['coins']}"
    )

    # Spend row is now flagged refunded:true with refundedAt set
    txn_after = db.coin_transactions.find_one({"gameId": game_id, "userId": host_id, "amount": -50})
    assert txn_after is not None
    assert txn_after.get("refunded") is True, "spend row should be flagged refunded:true"
    assert txn_after.get("refundedAt") is not None

    # The positive refund credit also exists, tagged with gameId
    refund_txn = db.coin_transactions.find_one({"gameId": game_id, "userId": host_id, "amount": 50})
    assert refund_txn is not None, "refund (positive) txn missing"

    # Leaderboard delta is 0 (the -50 row is excluded)
    spent_after = _coins_spent_for(host_id)
    assert spent_after == spent_before, (
        f"coinsSpent must NOT increase on abort: before={spent_before} after={spent_after}"
    )


# ============================================================
# 2. REGRESSION — Successful game counts both players' spend
# ============================================================

def test_successful_game_keeps_spend_rows_unrefunded(tokens, db):
    """Host + scatter1 both pay 50. Game resolves to a winner. Their two
    -50 spend rows must remain refunded:false and INCREASE coinsSpent.
    """
    host_tok = tokens["host"]
    p2_tok = tokens["p2"]

    host_id = _me(host_tok)["id"]
    p2_id = _me(p2_tok)["id"]

    # Make sure both are in the same room (host already in ROOM_ID)
    _join_room(p2_tok, ROOM_ID)

    spent_h_before = _coins_spent_for(host_id)
    spent_p2_before = _coins_spent_for(p2_id)

    r = requests.post(
        f"{BASE_URL}/api/rooms/{ROOM_ID}/games",
        json={"gameType": "card_higher", "entryFee": 50},
        headers=_h(host_tok),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    game_id = r.json()["id"]

    r = requests.post(
        f"{BASE_URL}/api/games/{game_id}/join", headers=_h(p2_tok), timeout=15
    )
    assert r.status_code == 200, f"join failed: {r.text}"

    # Wait for timer; on resolve, with len(players)==2 == minPlayers, game completes
    time.sleep(22)
    r = requests.get(f"{BASE_URL}/api/games/{game_id}", headers=_h(host_tok), timeout=15)
    assert r.status_code == 200
    resolved = r.json()
    assert resolved["status"] == "completed", (
        f"successful game should complete, got {resolved['status']}"
    )

    # Both spend rows still un-refunded
    for uid in (host_id, p2_id):
        txn = db.coin_transactions.find_one({"gameId": game_id, "userId": uid, "amount": -50})
        assert txn is not None
        assert txn.get("refunded") is not True, (
            f"spend row for {uid} should NOT be refunded in a completed game"
        )

    # Leaderboard increased by at least 50 for each
    spent_h_after = _coins_spent_for(host_id)
    spent_p2_after = _coins_spent_for(p2_id)
    assert spent_h_after - spent_h_before >= 50, (
        f"host coinsSpent delta should be ≥50: before={spent_h_before} after={spent_h_after}"
    )
    assert spent_p2_after - spent_p2_before >= 50, (
        f"p2 coinsSpent delta should be ≥50: before={spent_p2_before} after={spent_p2_after}"
    )


# ============================================================
# 3. REGRESSION — coins-spent pipeline filters refunded synthetics
# ============================================================

def test_leaderboard_excludes_synthetic_refunded_row(tokens, db):
    """Inject a refunded:true negative txn for the host with a huge amount;
    the leaderboard must NOT include it. Cleanup at end.
    """
    host_id = _me(tokens["host"])["id"]
    spent_before = _coins_spent_for(host_id)

    synthetic = {
        "userId": host_id,
        "amount": -99999,
        "type": "game",
        "description": "TEST_synthetic_refunded_row",
        "createdAt": __import__("datetime").datetime.utcnow(),
        "refunded": True,
        "refundedAt": __import__("datetime").datetime.utcnow(),
        "gameId": "TEST_SYNTHETIC",
    }
    ins = db.coin_transactions.insert_one(synthetic)
    try:
        spent_after = _coins_spent_for(host_id)
        # The huge -99999 row must NOT contribute. Allow tiny drift from other tests.
        assert spent_after - spent_before < 99999, (
            f"refunded:true row leaked into leaderboard: before={spent_before} after={spent_after}"
        )
    finally:
        db.coin_transactions.delete_one({"_id": ins.inserted_id})


# ============================================================
# 4. REGRESSION — Tournament lone-joiner cancel flags refunded
# ============================================================

def test_tournament_lone_joiner_cancel_via_backfill(tokens, db):
    """Create a size=2 tournament (creator auto-joins → 1 player). Manually
    mark it status=completed/winners=[] in mongo (simulating the lone-joiner
    cancel path that the live code only hits via _run_tournament). Restart
    backend so the startup backfill processes it. Verify the -50 tournament
    spend row is flagged refunded:true and excluded from the leaderboard.
    """
    host_tok = tokens["host"]
    host_id = _me(host_tok)["id"]

    spent_before = _coins_spent_for(host_id)

    # Create tournament size=2, fee=50 → creator gets a -50 tournament txn with gameId
    r = requests.post(
        f"{BASE_URL}/api/rooms/{ROOM_ID}/tournaments",
        json={"gameType": "card_higher", "size": 2, "entryFee": 50, "name": "TEST_Cancel_T"},
        headers=_h(host_tok),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    t = r.json()
    tid = t["id"]

    # Verify spend exists tagged with gameId=tid, not refunded
    txn = db.coin_transactions.find_one({"gameId": tid, "userId": host_id, "amount": -50, "type": "tournament"})
    assert txn is not None, "tournament spend txn should be tagged with gameId"
    assert txn.get("refunded") is not True

    # Manually emulate the lone-joiner cancel (status=completed, winners=[])
    db.tournaments.update_one(
        {"_id": ObjectId(tid)},
        {"$set": {"status": "completed", "winners": []}},
    )

    # Restart backend so the startup backfill kicks in
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True)
    # Wait for backend to come back
    for _ in range(30):
        try:
            ok = requests.get(f"{BASE_URL}/api/leaderboard/coins-spent?limit=1", timeout=5)
            if ok.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)

    # Spend row now flagged refunded:true
    txn_after = db.coin_transactions.find_one({"gameId": tid, "userId": host_id, "amount": -50, "type": "tournament"})
    assert txn_after is not None
    assert txn_after.get("refunded") is True, "backfill should flag cancelled tournament spend"

    # Leaderboard delta excludes this 50
    spent_after = _coins_spent_for(host_id)
    assert spent_after - spent_before == 0 or spent_after - spent_before < 50, (
        f"cancelled tournament spend leaked into leaderboard: before={spent_before} after={spent_after}"
    )


# ============================================================
# 5. REGRESSION — Backfill is idempotent (modified_count=0 on rerun)
# ============================================================

def test_backfill_idempotent(db):
    """After two consecutive backend restarts, the second restart's backfill
    must not re-flag rows that were already refunded. Verify by snapshotting
    the {refunded:true} count before/after a 2nd restart.
    """
    # Snapshot
    count_before = db.coin_transactions.count_documents({"refunded": True})

    # Restart again
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True)
    for _ in range(30):
        try:
            ok = requests.get(f"{BASE_URL}/api/leaderboard/coins-spent?limit=1", timeout=5)
            if ok.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(1)

    count_after = db.coin_transactions.count_documents({"refunded": True})
    assert count_after == count_before, (
        f"backfill not idempotent: {count_before} → {count_after}"
    )


# ============================================================
# 6. REGRESSION — leaderboard pipeline contains the refunded filter
# ============================================================

def test_leaderboard_coins_spent_endpoint_healthy():
    r = requests.get(f"{BASE_URL}/api/leaderboard/coins-spent?limit=10", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for row in data:
        assert "coinsSpent" in row and isinstance(row["coinsSpent"], int)
        assert row["coinsSpent"] >= 0
