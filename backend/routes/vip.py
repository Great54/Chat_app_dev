"""VIP router — tier purchase, perks, Pro customization.

Extracted from server.py during the P1 refactor (Jun 2026)."""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from bson import ObjectId
from fastapi import Depends, HTTPException

from server import (
    api_router,
    db,
    add_coins,
    get_current_user,
    get_tier_config,
    get_allowed_badge_ids,
    create_room_activity,
    _create_activity,
    _build_user_profile,
    VIP_TIERS_CONFIG,
    VIP_PRO_BADGES,
    VIP_ELITE_BADGES,
    VIP_TIER_CONFIG,
    VIP_PRO_AURAS,
    VIP_PRO_COLORS,
    VIP_PRO_MONTHLY_COINS,
    VIP_PRO_GRANT_INTERVAL_DAYS,
    VipPurchase,
    VipProSettings,
    UserProfile,
)

# ==================== VIP ====================

@api_router.get("/vip/tiers")
async def get_vip_tiers():
    """List available VIP tiers"""
    return list(VIP_TIERS_CONFIG.values())

@api_router.post("/vip/purchase")
async def purchase_vip(req: VipPurchase, current_user: dict = Depends(get_current_user)):
    """Buy a VIP tier with coins"""
    user_id = str(current_user["_id"])
    
    if req.tier not in VIP_TIERS_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid VIP tier")
    
    tier_config = VIP_TIERS_CONFIG[req.tier]
    current_tier = current_user.get("vipTier")
    
    # Compute effective price (Pro upgrading to Elite pays difference)
    effective_price = tier_config["price"]
    if current_tier == "pro" and req.tier == "elite":
        effective_price = tier_config["price"] - VIP_TIERS_CONFIG["pro"]["price"]
    elif current_tier == req.tier:
        raise HTTPException(status_code=400, detail=f"You already have {tier_config['name']}")
    elif current_tier == "elite" and req.tier == "pro":
        raise HTTPException(status_code=400, detail="Cannot downgrade from Elite to Pro")

    # 🧪 TEST MODE — VIP subscriptions are FREE for everyone right now so the
    # owner can verify the upgrade flow end-to-end. Remove this block to
    # re-enable the coin price check. (See PRD backlog: "Re-gate VIP price.")
    VIP_TEST_MODE_FREE = True
    if VIP_TEST_MODE_FREE:
        effective_price = 0

    if current_user.get("coins", 0) < effective_price:
        raise HTTPException(
            status_code=400,
            detail=f"Need {effective_price} coins (you have {current_user.get('coins', 0)})"
        )

    # Deduct price (zero in test mode → no-op)
    if effective_price > 0:
        await add_coins(user_id, -effective_price, "vip_purchase", f"Purchased {tier_config['name']}")
    # Award bonus coins
    await add_coins(user_id, tier_config["bonusCoins"], "vip_bonus", f"{tier_config['name']} signup bonus")
    
    # Apply VIP tier + vouchers
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"vipTier": req.tier}, "$inc": {"vouchers": tier_config["vouchers"]}}
    )
    
    # Notification
    await db.notifications.insert_one({
        "userId": user_id,
        "title": f"👑 Welcome to {tier_config['name']}!",
        "body": f"You received {tier_config['bonusCoins']} bonus coins and {tier_config['vouchers']} vouchers.",
        "type": "achievement",
        "createdAt": datetime.utcnow(),
        "readStatus": False
    })

    # Feed activity (public to friends — VIP is a flex)
    activity_type = "vip_purchased" if req.tier == "pro" else "elite_purchased" if req.tier == "elite" else "vip_purchased"
    await _create_activity(
        user_id=user_id,
        actor_id=None,
        activity_type=activity_type,
        message=f"unlocked {tier_config['name']}",
        metadata={
            "tier": req.tier,
            "tierName": tier_config["name"],
            "bonusCoins": tier_config["bonusCoins"],
            "vouchers": tier_config["vouchers"],
        },
        audience="friends",
    )

    # Also log to room feed if user is in a room
    current_room_id = current_user.get("currentRoomId")
    if current_room_id:
        await create_room_activity(
            room_id=current_room_id,
            activity_type="vip_purchased",
            actor_id=user_id,
            metadata={
                "tier": req.tier,
                "tierName": tier_config["name"]
            }
        )

    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    return _build_user_profile(updated)

@api_router.get("/vip/vouchers")
async def get_vouchers(current_user: dict = Depends(get_current_user)):
    """Get available shopping vouchers based on user's VIP tier"""
    tier = current_user.get("vipTier")
    voucher_count = current_user.get("vouchers", 0)
    
    if not tier:
        return {"vouchers": [], "available": 0, "vipTier": None}
    
    discount = VIP_TIERS_CONFIG[tier]["voucherDiscount"]
    
    sample_vouchers = [
        {"brand": "Amazon", "discount": f"{discount}% OFF", "icon": "cart"},
        {"brand": "Starbucks", "discount": f"{discount}% OFF", "icon": "cafe"},
        {"brand": "Netflix", "discount": f"{discount}% OFF", "icon": "film"},
        {"brand": "Spotify", "discount": f"{discount}% OFF", "icon": "musical-notes"},
        {"brand": "Uber Eats", "discount": f"{discount}% OFF", "icon": "fast-food"},
        {"brand": "Nike", "discount": f"{discount}% OFF", "icon": "fitness"},
    ]
    
    return {
        "vouchers": sample_vouchers,
        "available": voucher_count,
        "vipTier": tier,
        "discount": discount,
    }

# ==================== VIP PRO CUSTOMIZATION ====================

@api_router.get("/vip-pro/catalog")
async def get_vip_pro_catalog():
    """Return badges (Pro + Elite), auras, color palettes, and tier configs."""
    return {
        "badges": VIP_PRO_BADGES,                       # legacy / Pro set
        "eliteBadges": VIP_ELITE_BADGES,                # Elite-exclusive set
        "auras": VIP_PRO_AURAS,
        "colors": VIP_PRO_COLORS,
        "monthlyCoins": VIP_PRO_MONTHLY_COINS,          # legacy field (Pro)
        "grantIntervalDays": VIP_PRO_GRANT_INTERVAL_DAYS,
        "tiers": VIP_TIER_CONFIG,
    }

@api_router.get("/vip-pro/settings")
async def get_vip_pro_settings(current_user: dict = Depends(get_current_user)):
    """Return current user's VIP Pro/Elite customization settings and monthly grant info."""
    tier = current_user.get("vipTier")
    cfg = get_tier_config(tier)
    monthly_coins = cfg["monthlyCoins"] if cfg else VIP_PRO_MONTHLY_COINS
    interval_days = cfg["grantIntervalDays"] if cfg else VIP_PRO_GRANT_INTERVAL_DAYS
    last_grant = current_user.get("vipProMonthlyGrantAt")
    next_grant_in_days = None
    if last_grant:
        elapsed = (datetime.utcnow() - last_grant).days
        next_grant_in_days = max(0, interval_days - elapsed)
    return {
        "vipTier": tier,
        "tierLabel": cfg["label"] if cfg else None,
        "allowedBadgeSets": cfg["badgeSets"] if cfg else [],
        "vipBadgeId": current_user.get("vipBadgeId"),
        "auraType": current_user.get("auraType"),
        "auraColor": current_user.get("auraColor"),
        "chatColor": current_user.get("chatColor"),
        "usernameColor": current_user.get("usernameColor"),
        "pmBoxColor": current_user.get("pmBoxColor"),
        "enlargedAvatar": bool(current_user.get("enlargedAvatar", False)),
        "vipProMonthlyGrantAt": last_grant.isoformat() if last_grant else None,
        "nextGrantInDays": next_grant_in_days,
        "monthlyCoins": monthly_coins,
    }

@api_router.put("/vip-pro/settings")
async def update_vip_pro_settings(payload: VipProSettings, current_user: dict = Depends(get_current_user)):
    """Update VIP Pro customization. Requires VIP Pro or Elite."""
    tier = current_user.get("vipTier")
    if tier not in ("pro", "elite"):
        raise HTTPException(status_code=403, detail="VIP Pro or Elite required for customization")

    update_fields: Dict[str, Any] = {}

    # Badge — validate against the tier's allowed badge set
    if payload.vipBadgeId is not None:
        if payload.vipBadgeId == "":
            update_fields["vipBadgeId"] = None
        else:
            allowed = get_allowed_badge_ids(tier)
            if payload.vipBadgeId not in allowed:
                raise HTTPException(status_code=400, detail="Invalid or unavailable badge for your tier")
            update_fields["vipBadgeId"] = payload.vipBadgeId

    # Aura type
    if payload.auraType is not None:
        if payload.auraType == "" or payload.auraType == "none":
            update_fields["auraType"] = None
        else:
            valid_auras = {a["id"] for a in VIP_PRO_AURAS}
            if payload.auraType not in valid_auras:
                raise HTTPException(status_code=400, detail="Invalid aura type")
            update_fields["auraType"] = payload.auraType

    # Colors – accept any hex code starting with '#'
    def _validate_color(c: Optional[str]) -> Optional[str]:
        if c is None:
            return None
        c = c.strip()
        if c == "":
            return ""
        if not c.startswith("#") or len(c) not in (4, 7, 9):
            raise HTTPException(status_code=400, detail=f"Invalid color: {c}")
        return c

    for field in ("auraColor", "chatColor", "usernameColor", "pmBoxColor"):
        v = getattr(payload, field)
        if v is not None:
            cv = _validate_color(v)
            update_fields[field] = None if cv == "" else cv

    if payload.enlargedAvatar is not None:
        update_fields["enlargedAvatar"] = bool(payload.enlargedAvatar)

    user_oid = ObjectId(str(current_user["_id"]))
    if update_fields:
        await db.users.update_one(
            {"_id": user_oid},
            {"$set": update_fields},
        )

    updated = await db.users.find_one({"_id": user_oid})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_user_profile(updated)

# ==================== VIP ROUTES (continued) ====================

