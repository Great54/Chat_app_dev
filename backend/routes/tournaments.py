"""Tournaments router — extracted from server.py during the P1 refactor.

This module owns the knockout tournament feature:
- public / private tournaments (private = invite-code only)
- tiered prize distribution (1 / 2 / k winners depending on n_players)
- bracket simulation (`_run_tournament`) and elimination-round-based placements
- `Hall of Champions` leaderboard endpoint

All shared state (`api_router`, `db`, helpers like `add_coins`, `GAME_TYPES`,
`_play_match`, `_round_name`, `_award_tournament_placement`, etc.) is imported
from `server` to avoid duplication. server.py defines everything and then
imports this module at the bottom — that one-way arrow keeps imports linear
and side-effect free."""

import math
import random
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import (
    api_router,
    db,
    add_coins,
    get_current_user,
    GAME_TYPES,
)

# ==================== TOURNAMENTS ====================
# Knockout tournament with dynamic size (2-32) and dynamic entry fee.
# Prize distribution depends on number of players:
#  • <= 4 players  → 1 winner takes 100% of pot
#  • 5..10 players → 2 winners, 70%/30% split
#  • > 10 players  → ceil(0.30 * n) winners, ratios n:(n-1):...:1
# Tournaments are visible (in lobby OR for 5h after completion) per-room.
# Tournaments may be PUBLIC (listed) or PRIVATE (hidden, joinable by 6-char code).

TOURNAMENT_MIN_SIZE = 2
TOURNAMENT_MAX_SIZE = 32
TOURNAMENT_MIN_FEE = 1
TOURNAMENT_MAX_FEE = 100000
TOURNAMENT_VISIBLE_HOURS = 5
CHAMPION_VIP_TIER = "pro"
CHAMPION_VIP_DAYS = 30
TOURNAMENT_POINTS = {1: 30, 2: 20, 3: 10}
TOURNAMENT_JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # avoid I,O,1,0

def _generate_join_code() -> str:
    return "".join(random.choice(TOURNAMENT_JOIN_CODE_ALPHABET) for _ in range(6))

def _winners_count(n_players: int) -> int:
    """How many players receive coin prizes based on tournament size."""
    if n_players <= 4:
        return 1
    if n_players <= 10:
        return 2
    # >10 players: 30% of players are winners (at least 3)
    return max(3, math.ceil(0.3 * n_players))

def _prize_split(pot: int, n_players: int) -> List[int]:
    """Return a list of coin amounts, one per winner, summing exactly to pot.
    Ratios: 1 winner -> [1]; 2 winners (5-10p) -> 7:3; k>=3 winners -> k:(k-1):...:1.
    Any rounding remainder is given to the champion."""
    k = _winners_count(n_players)
    if pot <= 0 or k <= 0:
        return [0] * max(k, 1)
    if k == 1:
        return [pot]
    if k == 2:
        runner = pot * 30 // 100
        return [pot - runner, runner]
    # k >= 3: ratios k, k-1, ..., 1
    weights = list(range(k, 0, -1))  # e.g. [4,3,2,1]
    total_w = sum(weights)            # k*(k+1)/2
    shares = [pot * w // total_w for w in weights]
    # remainder → champion (1st)
    shares[0] += pot - sum(shares)
    return shares

class TournamentCreate(BaseModel):
    gameType: str
    name: Optional[str] = None
    size: Optional[int] = 4
    entryFee: Optional[int] = 10
    isPrivate: Optional[bool] = False

class TournamentJoinByCode(BaseModel):
    code: str

def _serialize_tournament(t: dict, *, viewer_id: Optional[str] = None) -> dict:
    gt_cfg = GAME_TYPES.get(t["gameType"], {})
    # Only expose join code to creator or already-joined players
    join_code = t.get("joinCode")
    show_code = False
    if join_code and viewer_id:
        if viewer_id == t.get("createdBy"):
            show_code = True
        elif any(p.get("userId") == viewer_id for p in t.get("players", [])):
            show_code = True
    return {
        "id": str(t["_id"]),
        "roomId": t["roomId"],
        "gameType": t["gameType"],
        "gameTypeName": gt_cfg.get("name", t["gameType"]),
        "image": gt_cfg.get("image"),
        "icon": gt_cfg.get("icon", "trophy"),
        "name": t.get("name") or f"{gt_cfg.get('name', 'Game')} Knockout",
        "status": t["status"],
        "size": t["size"],
        "entryFee": t["entryFee"],
        "pot": t.get("pot", 0),
        "winnerShare": t.get("winnerShare"),
        "runnerShare": t.get("runnerShare"),
        "prizeShares": t.get("prizeShares", []),
        "players": t.get("players", []),
        "bracket": t.get("bracket", []),
        "winners": t.get("winners", []),
        "createdBy": t.get("createdBy"),
        "createdByName": t.get("createdByName"),
        "createdAt": t.get("createdAt"),
        "completedAt": t.get("completedAt"),
        "isPrivate": bool(t.get("isPrivate", False)),
        "joinCode": join_code if show_code else None,
    }

@api_router.get("/rooms/{room_id}/tournaments")
async def list_room_tournaments(room_id: str, current_user: dict = Depends(get_current_user)):
    cutoff = datetime.utcnow() - timedelta(hours=TOURNAMENT_VISIBLE_HOURS)
    me_id = str(current_user["_id"])
    tournaments = await db.tournaments.find({
        "roomId": room_id,
        "$or": [{"status": {"$in": ["lobby", "running"]}}, {"completedAt": {"$gte": cutoff}}],
    }).sort("createdAt", -1).to_list(50)
    # Privacy: filter out private tournaments unless creator or already joined
    visible = []
    for t in tournaments:
        if t.get("isPrivate"):
            if t.get("createdBy") != me_id and not any(p.get("userId") == me_id for p in t.get("players", [])):
                continue
        visible.append(t)
    return [_serialize_tournament(t, viewer_id=me_id) for t in visible]

@api_router.post("/rooms/{room_id}/tournaments")
async def create_tournament(room_id: str, payload: TournamentCreate, current_user: dict = Depends(get_current_user)):
    if payload.gameType not in GAME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid game type")
    size = payload.size if payload.size is not None else 4
    fee = payload.entryFee if payload.entryFee is not None else 10
    if size < TOURNAMENT_MIN_SIZE or size > TOURNAMENT_MAX_SIZE:
        raise HTTPException(status_code=400, detail=f"Size must be between {TOURNAMENT_MIN_SIZE} and {TOURNAMENT_MAX_SIZE}")
    if fee < TOURNAMENT_MIN_FEE or fee > TOURNAMENT_MAX_FEE:
        raise HTTPException(status_code=400, detail=f"Entry fee must be between {TOURNAMENT_MIN_FEE} and {TOURNAMENT_MAX_FEE} coins")
    if current_user.get("currentRoomId") != room_id:
        raise HTTPException(status_code=403, detail="Join the room first")
    if current_user.get("coins", 0) < fee:
        raise HTTPException(status_code=400, detail=f"Need {fee} coins to host & enter")

    me_id = str(current_user["_id"])

    gt_cfg = GAME_TYPES[payload.gameType]
    is_private = bool(payload.isPrivate)
    # Generate a unique 6-char join code for private tournaments
    join_code: Optional[str] = None
    if is_private:
        for _ in range(8):
            candidate = _generate_join_code()
            exists = await db.tournaments.find_one({"joinCode": candidate, "status": {"$in": ["lobby", "running"]}})
            if not exists:
                join_code = candidate
                break
        if not join_code:
            join_code = _generate_join_code()

    doc = {
        "roomId": room_id,
        "gameType": payload.gameType,
        "name": (payload.name or f"{gt_cfg['name']} Knockout"),
        "status": "lobby",
        "size": size,
        "entryFee": fee,
        "pot": fee,
        "players": [{
            "userId": me_id,
            "username": current_user["username"],
            "displayName": current_user["displayName"],
            "photoUrl": current_user.get("photoUrl"),
        }],
        "bracket": [],
        "winners": [],
        "createdBy": me_id,
        "createdByName": current_user["displayName"],
        "createdAt": datetime.utcnow(),
        "isPrivate": is_private,
        "joinCode": join_code,
    }
    res = await db.tournaments.insert_one(doc)
    doc["_id"] = res.inserted_id

    # Deduct entry fee from creator (auto-joined as first player). Tag with
    # the tournament id so a cancelled tournament can flag this row refunded
    # for the coins-spent leaderboard.
    await add_coins(me_id, -fee, "tournament", "Tournament entry fee", game_id=str(res.inserted_id))

    # System message in chat — for public tournaments only
    if not is_private:
        await db.messages.insert_one({
            "roomId": room_id,
            "senderId": "system",
            "senderName": "🏆 Tournament",
            "senderPhoto": None,
            "messageText": f"{current_user['displayName']} scheduled a {gt_cfg['name']} knockout · {size} players · {fee}🪙 entry · Tap the trophy to join",
            "createdAt": datetime.utcnow(),
            "reactions": [],
            "isSystem": True,
        })
    return _serialize_tournament(doc, viewer_id=me_id)

@api_router.post("/tournaments/join-by-code")
async def join_tournament_by_code(payload: TournamentJoinByCode, current_user: dict = Depends(get_current_user)):
    """Join a (typically private) tournament using its 6-character invite code."""
    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Enter a join code")
    t = await db.tournaments.find_one({"joinCode": code, "status": "lobby"})
    if not t:
        raise HTTPException(status_code=404, detail="No open tournament with that code")
    if current_user.get("currentRoomId") != t["roomId"]:
        raise HTTPException(status_code=403, detail="Join the tournament's room first")
    me_id = str(current_user["_id"])
    if any(p["userId"] == me_id for p in t["players"]):
        return _serialize_tournament(t, viewer_id=me_id)
    if len(t["players"]) >= t["size"]:
        raise HTTPException(status_code=400, detail="Tournament is full")
    if current_user.get("coins", 0) < t["entryFee"]:
        raise HTTPException(status_code=400, detail=f"Need {t['entryFee']} coins")

    await add_coins(me_id, -t["entryFee"], "tournament", "Tournament entry fee", game_id=str(t["_id"]))
    new_player = {
        "userId": me_id,
        "username": current_user["username"],
        "displayName": current_user["displayName"],
        "photoUrl": current_user.get("photoUrl"),
    }
    await db.tournaments.update_one(
        {"_id": t["_id"]},
        {"$push": {"players": new_player}, "$inc": {"pot": t["entryFee"]}},
    )
    updated = await db.tournaments.find_one({"_id": t["_id"]})
    if len(updated["players"]) >= updated["size"]:
        updated = await _run_tournament(updated)
    return _serialize_tournament(updated, viewer_id=me_id)

@api_router.post("/tournaments/{tid}/join")
async def join_tournament(tid: str, current_user: dict = Depends(get_current_user)):
    t = await db.tournaments.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if t["status"] != "lobby":
        raise HTTPException(status_code=400, detail="Tournament already started")
    if current_user.get("currentRoomId") != t["roomId"]:
        raise HTTPException(status_code=403, detail="Join the room first")

    me_id = str(current_user["_id"])
    # Private tournaments cannot be joined through the public id endpoint
    # (unless the user has already been added to it).
    if t.get("isPrivate") and t.get("createdBy") != me_id and not any(p["userId"] == me_id for p in t["players"]):
        raise HTTPException(status_code=403, detail="This is a private tournament — use the join code")
    if any(p["userId"] == me_id for p in t["players"]):
        raise HTTPException(status_code=400, detail="Already joined")
    if len(t["players"]) >= t["size"]:
        raise HTTPException(status_code=400, detail="Tournament is full")
    if current_user.get("coins", 0) < t["entryFee"]:
        raise HTTPException(status_code=400, detail=f"Need {t['entryFee']} coins")

    await add_coins(me_id, -t["entryFee"], "tournament", "Tournament entry fee", game_id=str(t["_id"]))
    new_player = {
        "userId": me_id,
        "username": current_user["username"],
        "displayName": current_user["displayName"],
        "photoUrl": current_user.get("photoUrl"),
    }
    await db.tournaments.update_one(
        {"_id": ObjectId(tid)},
        {"$push": {"players": new_player}, "$inc": {"pot": t["entryFee"]}},
    )
    updated = await db.tournaments.find_one({"_id": ObjectId(tid)})

    # Auto-start when full
    if len(updated["players"]) >= updated["size"]:
        updated = await _run_tournament(updated)
    return _serialize_tournament(updated, viewer_id=me_id)

@api_router.post("/tournaments/{tid}/start")
async def start_tournament(tid: str, current_user: dict = Depends(get_current_user)):
    """Manual start (creator only) once at least 2 players joined."""
    t = await db.tournaments.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if t["status"] != "lobby":
        raise HTTPException(status_code=400, detail="Already started")
    if str(current_user["_id"]) != t["createdBy"]:
        raise HTTPException(status_code=403, detail="Only creator can start")
    if len(t["players"]) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")
    t = await _run_tournament(t)
    return _serialize_tournament(t, viewer_id=str(current_user["_id"]))

def _play_match(p1: dict, p2: dict, game_type: str) -> tuple:
    """Returns (winner, loser, score_winner, score_loser). Reroll on ties."""
    while True:
        if game_type == "card_higher":
            s1 = random.randint(1, 13)
            s2 = random.randint(1, 13)
        elif game_type == "dice_roll":
            s1 = random.randint(1, 6) + random.randint(1, 6)
            s2 = random.randint(1, 6) + random.randint(1, 6)
        else:
            s1 = random.randint(1, 100)
            s2 = random.randint(1, 100)
        if s1 != s2:
            break
    if s1 > s2:
        return p1, p2, s1, s2
    return p2, p1, s2, s1

async def _award_tournament_placement(user_id: str, placement: int, coins: int, tournament_name: str):
    """Award coins (from pot split) + points (+VIP for champion) for a placement."""
    points = TOURNAMENT_POINTS.get(placement, 0)
    if coins > 0:
        await add_coins(user_id, coins, "tournament_win", f"#{placement} in {tournament_name}")
    inc_fields: Dict[str, int] = {}
    if points:
        inc_fields["pointsEarned"] = points
    if placement == 1:
        inc_fields["tournamentsWon"] = 1
    if inc_fields:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": inc_fields})
    if placement == 1:
        expires_at = datetime.utcnow() + timedelta(days=CHAMPION_VIP_DAYS)
        # Don't downgrade a user who is already on a higher tier than 'pro'.
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)}, {"vipTier": 1})
        current_tier = (user_doc or {}).get("vipTier")
        higher_tiers = {"elite", "legend"}
        if current_tier in higher_tiers:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"vipExpiresAt": expires_at}},
            )
        else:
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"vipTier": CHAMPION_VIP_TIER, "vipExpiresAt": expires_at}},
            )
    medal = {1: "🏆", 2: "🥈", 3: "🥉"}.get(placement, "🎖")
    parts: List[str] = []
    if coins > 0:
        parts.append(f"+{coins} coins")
    if points:
        parts.append(f"+{points} points")
    if placement == 1:
        parts.append(f"VIP Pro unlocked ({CHAMPION_VIP_DAYS} days)")
    body = " · ".join(parts) if parts else "Reward unlocked"
    await db.notifications.insert_one({
        "userId": user_id,
        "title": f"{medal} #{placement} in {tournament_name}",
        "body": body,
        "type": "tournament",
        "createdAt": datetime.utcnow(),
        "readStatus": False,
    })

def _round_name(remaining: int) -> str:
    """remaining = players entering this round."""
    if remaining == 2:
        return "final"
    if remaining <= 4:
        return "semifinal"
    if remaining <= 8:
        return "quarterfinal"
    if remaining <= 16:
        return "round-of-16"
    return f"round-of-{remaining}"

async def _run_tournament(t: dict) -> dict:
    """Simulate the bracket for any size 2..N. Prize distribution depends on player count:
       - <=4 players  -> 1 winner takes 100% of pot
       - 5..10        -> 2 winners, 70/30
       - >10          -> ceil(0.3*n) winners, ratios n:(n-1):...:1
    Placements are derived from the elimination round in the knockout bracket."""
    players = list(t["players"])
    game_type = t["gameType"]
    tid = t["_id"]
    name = t.get("name", "Tournament")
    entry_fee = t.get("entryFee", 10)
    actual_pot = entry_fee * len(players)
    bracket: List[Dict[str, Any]] = []

    if len(players) < 2:
        # Edge case: lone joiner — refund + abort.
        # Mark the original negative entry-fee row(s) as refunded so the
        # coins-spent leaderboard excludes them.
        await db.coin_transactions.update_many(
            {
                "gameId": str(tid),
                "type": "tournament",
                "amount": {"$lt": 0},
            },
            {"$set": {"refunded": True, "refundedAt": datetime.utcnow()}},
        )
        if players:
            await add_coins(players[0]["userId"], entry_fee, "refund", f"{name} cancelled — not enough players", game_id=str(tid))
        await db.tournaments.update_one(
            {"_id": tid},
            {"$set": {"status": "completed", "winners": [], "bracket": [], "completedAt": datetime.utcnow(), "pot": 0}},
        )
        return await db.tournaments.find_one({"_id": tid})

    random.shuffle(players)
    current_round = list(players)
    # Track when each player was eliminated (round index, 0-based). Champion stays None.
    eliminated_round: Dict[str, int] = {}

    round_idx = 0
    while len(current_round) > 1:
        next_round: List[Dict[str, Any]] = []
        matches: List[Dict[str, Any]] = []
        i = 0
        round_label = _round_name(len(current_round))

        while i < len(current_round) - 1:
            p1, p2 = current_round[i], current_round[i + 1]
            winner, loser, sw, sl = _play_match(p1, p2, game_type)
            matches.append({
                "p1": p1,
                "p2": p2,
                "winner": winner["userId"],
                "scoreP1": sw if winner == p1 else sl,
                "scoreP2": sw if winner == p2 else sl,
            })
            next_round.append(winner)
            eliminated_round[loser["userId"]] = round_idx
            i += 2

        # Bye for odd man out
        if i < len(current_round):
            bye = current_round[i]
            matches.append({"p1": bye, "p2": None, "winner": bye["userId"], "scoreP1": 0, "scoreP2": 0, "bye": True})
            next_round.append(bye)

        bracket.append({"round": round_label, "matches": matches})
        current_round = next_round
        round_idx += 1

    champion = current_round[0]

    # Compute placements: champion first, then players sorted by elimination round desc.
    n_players = len(players)
    n_winners = _winners_count(n_players)
    shares = _prize_split(actual_pot, n_players)

    # Build ranking: champion → 1st, then descending eliminated_round, then bracket order (stable)
    others = [p for p in players if p["userId"] != champion["userId"]]
    others.sort(key=lambda p: -eliminated_round.get(p["userId"], -1))
    ranked = [champion] + others
    top_k = ranked[:n_winners]

    winners_list: List[Dict[str, Any]] = []
    for idx, p in enumerate(top_k):
        placement = idx + 1
        coins_won = shares[idx] if idx < len(shares) else 0
        points = TOURNAMENT_POINTS.get(placement, max(5, 35 - placement * 5))
        winners_list.append({**p, "placement": placement, "coinsWon": coins_won, "pointsEarned": points})

    # Award everyone
    for w in winners_list:
        await _award_tournament_placement(w["userId"], w["placement"], w["coinsWon"], name)

    winner_share = shares[0] if shares else 0
    runner_share = shares[1] if len(shares) > 1 else 0

    await db.tournaments.update_one(
        {"_id": tid},
        {"$set": {
            "status": "completed",
            "bracket": bracket,
            "winners": winners_list,
            "pot": actual_pot,
            "winnerShare": winner_share,
            "runnerShare": runner_share,
            "prizeShares": shares,
            "completedAt": datetime.utcnow(),
        }},
    )

    # System message — top winners summary (max 3 listed inline)
    medals = {1: "🏆", 2: "🥈", 3: "🥉"}
    parts = []
    for w in winners_list[:3]:
        m = medals.get(w["placement"], f"#{w['placement']}")
        parts.append(f"{m} {w['displayName']} +{w['coinsWon']}🪙")
    extra = f" · +{len(winners_list) - 3} more winners" if len(winners_list) > 3 else ""
    await db.messages.insert_one({
        "roomId": t["roomId"],
        "senderId": "system",
        "senderName": "🏆 Tournament",
        "senderPhoto": None,
        "messageText": f"{name} finished · " + " · ".join(parts) + extra,
        "createdAt": datetime.utcnow(),
        "reactions": [],
        "isSystem": True,
    })

    return await db.tournaments.find_one({"_id": tid})

@api_router.get("/tournaments/{tid}")
async def get_tournament(tid: str, current_user: dict = Depends(get_current_user)):
    t = await db.tournaments.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return _serialize_tournament(t, viewer_id=str(current_user["_id"]))

@api_router.get("/tournaments/wins/leaderboard")
async def tournaments_wins_leaderboard(current_user: dict = Depends(get_current_user), limit: int = 20):
    """Global "Tournaments You've Won" leaderboard.
    Ranks users by their **#1 finishes** across all completed tournaments
    in the last 30 days. Returns top `limit` users + the caller's own rank.
    """
    since = datetime.utcnow() - timedelta(days=30)
    pipeline = [
        {"$match": {"status": "completed", "completedAt": {"$gte": since}}},
        {"$unwind": "$winners"},
        {"$match": {"winners.placement": 1}},
        {"$group": {
            "_id": "$winners.userId",
            "displayName": {"$last": "$winners.displayName"},
            "photoUrl":   {"$last": "$winners.photoUrl"},
            "wins":       {"$sum": 1},
            "coinsWon":   {"$sum": {"$ifNull": ["$winners.coinsWon", 0]}},
        }},
        {"$sort": {"wins": -1, "coinsWon": -1}},
        {"$limit": max(1, min(limit, 100))},
    ]
    rows = await db.tournaments.aggregate(pipeline).to_list(limit)
    leaderboard = [
        {
            "rank": i + 1,
            "userId": r["_id"],
            "displayName": r.get("displayName") or "Player",
            "photoUrl": r.get("photoUrl"),
            "wins": r["wins"],
            "coinsWon": r["coinsWon"],
        }
        for i, r in enumerate(rows)
    ]

    # Caller's own stats (rank may be outside `limit`)
    me_id = str(current_user["_id"])
    me_pipeline = [
        {"$match": {"status": "completed", "completedAt": {"$gte": since}, "winners.userId": me_id}},
        {"$unwind": "$winners"},
        {"$match": {"winners.userId": me_id, "winners.placement": 1}},
        {"$group": {"_id": None, "wins": {"$sum": 1}, "coinsWon": {"$sum": {"$ifNull": ["$winners.coinsWon", 0]}}}},
    ]
    me_agg = await db.tournaments.aggregate(me_pipeline).to_list(1)
    me_wins = me_agg[0]["wins"] if me_agg else 0
    me_coins = me_agg[0]["coinsWon"] if me_agg else 0
    me_rank = next((row["rank"] for row in leaderboard if row["userId"] == me_id), None)
    return {
        "windowDays": 30,
        "leaderboard": leaderboard,
        "me": {
            "userId": me_id,
            "displayName": current_user["displayName"],
            "photoUrl": current_user.get("photoUrl"),
            "wins": me_wins,
            "coinsWon": me_coins,
            "rank": me_rank,
        },
    }
