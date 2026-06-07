"""Leaderboard router — global rankings (VIP, room activity, etc.).

Extracted from server.py during the P1 refactor (Jun 2026)."""

from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import Depends

from server import api_router, db, get_current_user

# ==================== LEADERBOARD ====================

@api_router.get("/leaderboard/vip")
async def get_vip_leaderboard(limit: int = 50):
    """Top VIP users — Elite first, then Pro"""
    users = await db.users.find(
        {"vipTier": {"$in": ["pro", "elite"]}}
    ).to_list(limit)
    # Sort: Elite first then Pro, then by coins desc
    tier_rank = {"elite": 0, "pro": 1}
    users.sort(key=lambda u: (tier_rank.get(u.get("vipTier"), 99), -u.get("coins", 0)))
    return [
        {
            "rank": idx + 1,
            "id": str(user["_id"]),
            "username": user["username"],
            "displayName": user["displayName"],
            "photoUrl": user.get("photoUrl"),
            "vipTier": user.get("vipTier"),
            "coins": user.get("coins", 0),
        } for idx, user in enumerate(users[:limit])
    ]

@api_router.get("/leaderboard/xp")
async def get_xp_leaderboard_deprecated(limit: int = 50):
    """Deprecated — XP system removed. Returns VIP leaderboard for backward compat."""
    return await get_vip_leaderboard(limit=limit)

@api_router.get("/leaderboard/coins")
async def get_coins_leaderboard(limit: int = 50):
    users = await db.users.find().sort("coins", -1).limit(limit).to_list(limit)
    return [
        {
            "rank": idx + 1,
            "id": str(user["_id"]),
            "username": user["username"],
            "displayName": user["displayName"],
            "photoUrl": user.get("photoUrl"),
            "coins": user.get("coins", 0),
            "level": user.get("level", 0)
        } for idx, user in enumerate(users)
    ]

@api_router.get("/leaderboard/points")
async def get_points_leaderboard(limit: int = 50):
    """Points earned: +10 per game win, +5 per runner-up, +30/20/10 in tournaments."""
    users = await db.users.find(
        {"pointsEarned": {"$gt": 0}}
    ).sort("pointsEarned", -1).limit(limit).to_list(limit)
    return [
        {
            "rank": idx + 1,
            "id": str(user["_id"]),
            "username": user["username"],
            "displayName": user["displayName"],
            "photoUrl": user.get("photoUrl"),
            "vipTier": user.get("vipTier"),
            "pointsEarned": user.get("pointsEarned", 0),
            "gameWins": user.get("gameWins", 0),
            "gameRunnerUps": user.get("gameRunnerUps", 0),
            "tournamentsWon": user.get("tournamentsWon", 0),
        } for idx, user in enumerate(users)
    ]

@api_router.get("/leaderboard/coins-spent")
async def get_coins_spent_leaderboard(limit: int = 50):
    """Top spenders ranked by total coins spent (sum of negative coin_transactions)."""
    # spend types are negative entries with these labels
    pipeline = [
        {"$match": {"amount": {"$lt": 0}}},
        {"$group": {"_id": "$userId", "spent": {"$sum": "$amount"}}},
        {"$project": {"_id": 1, "spent": {"$abs": "$spent"}}},
        {"$sort": {"spent": -1}},
        {"$limit": limit},
    ]
    results = await db.coin_transactions.aggregate(pipeline).to_list(limit)
    leaderboard = []
    rank = 0
    for r in results:
        try:
            uid = ObjectId(r["_id"])
        except Exception:
            continue
        u = await db.users.find_one({"_id": uid})
        if not u:
            continue
        rank += 1
        leaderboard.append({
            "rank": rank,
            "id": str(u["_id"]),
            "username": u["username"],
            "displayName": u["displayName"],
            "photoUrl": u.get("photoUrl"),
            "vipTier": u.get("vipTier"),
            "coinsSpent": r["spent"],
        })
    return leaderboard

@api_router.get("/leaderboard/active")
async def get_active_leaderboard(limit: int = 50):
    """Most active users by message count"""
    pipeline = [
        # Exclude system messages (senderId="system") which are not valid ObjectIds
        {"$match": {"senderId": {"$ne": "system"}}},
        {"$group": {"_id": "$senderId", "messageCount": {"$sum": 1}}},
        {"$sort": {"messageCount": -1}},
        {"$limit": limit}
    ]
    
    results = await db.messages.aggregate(pipeline).to_list(limit)
    
    leaderboard = []
    for idx, result in enumerate(results):
        # Defensive: skip any non-ObjectId senderIds
        try:
            sender_oid = ObjectId(result["_id"])
        except Exception:
            continue
        user = await db.users.find_one({"_id": sender_oid})
        if user:
            leaderboard.append({
                "rank": idx + 1,
                "id": str(user["_id"]),
                "username": user["username"],
                "displayName": user["displayName"],
                "photoUrl": user.get("photoUrl"),
                "messageCount": result["messageCount"],
                "level": user.get("level", 0)
            })
    
    return leaderboard

