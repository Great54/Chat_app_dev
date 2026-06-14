"""
VIP subscription payments via Stripe Checkout.

Two fixed packages — prices defined here on the backend so the frontend can
NEVER manipulate them:
    - vip_pro    : ₹319 / month
    - vip_elite  : ₹499 / month

Currency is INR. Stripe Checkout supports international cards on INR sessions
out of the box, so a single integration handles both Indian and overseas
customers.

Endpoints
---------
GET  /api/payments/vip/packages    — public list of packages for UI
POST /api/payments/vip/checkout    — create a Stripe Checkout session
GET  /api/payments/status/{sid}    — poll the session (grants VIP on first paid)
POST /api/webhook/stripe           — Stripe webhook (also grants VIP)
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta

from bson import ObjectId
from fastapi import HTTPException, Depends, Request
from pydantic import BaseModel, Field

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest,
)

from server import api_router, db, get_current_user

logger = logging.getLogger(__name__)


def _stripe_for_request(request: Request) -> StripeCheckout:
    api_key = os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "Stripe is not configured on the server")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


# ---------------------------------------------------------------------------
# Fixed packages — NEVER read price from the client
# ---------------------------------------------------------------------------
VIP_PACKAGES: dict[str, dict] = {
    "vip_pro": {
        "tier": "pro",
        "amount": 319.00,
        "currency": "inr",
        "name": "VIP Pro (1 month)",
        "days": 30,
    },
    "vip_elite": {
        "tier": "elite",
        "amount": 499.00,
        "currency": "inr",
        "name": "VIP Elite (1 month)",
        "days": 30,
    },
}


class VipCheckoutRequest(BaseModel):
    packageId: str = Field(..., description="vip_pro | vip_elite")
    originUrl: str = Field(..., description="window.location.origin from the client")


async def _grant_vip_to_user(user_id: str, tier: str, days: int) -> None:
    """Mark the user as VIP and extend their expiry. Idempotent — safe to
    call repeatedly with the same session as long as the caller checked the
    transaction's processed flag first."""
    now = datetime.utcnow()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return
    current_expiry = user.get("vipExpiresAt")
    base = current_expiry if (isinstance(current_expiry, datetime) and current_expiry > now) else now
    new_expiry = base + timedelta(days=days)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "vipTier": tier,
                "vipExpiresAt": new_expiry,
                "vipUpdatedAt": now,
            }
        },
    )


@api_router.get("/payments/vip/packages")
async def list_vip_packages():
    """Public — used by the frontend to render Pro/Elite cards."""
    return [
        {
            "id": pid,
            "tier": p["tier"],
            "name": p["name"],
            "amount": p["amount"],
            "currency": p["currency"].upper(),
            "days": p["days"],
        }
        for pid, p in VIP_PACKAGES.items()
    ]


@api_router.post("/payments/vip/checkout")
async def create_vip_checkout(
    body: VipCheckoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    pkg = VIP_PACKAGES.get(body.packageId)
    if not pkg:
        raise HTTPException(400, "Unknown package")

    origin = body.originUrl.rstrip("/")
    success_url = f"{origin}/payments/return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payments/cancel"

    stripe = _stripe_for_request(request)
    req = CheckoutSessionRequest(
        amount=pkg["amount"],
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "userId": str(current_user["_id"]),
            "packageId": body.packageId,
            "tier": pkg["tier"],
            "source": "vip_subscription",
        },
    )
    session: CheckoutSessionResponse = await stripe.create_checkout_session(req)

    # Persist a pending transaction BEFORE returning the URL.
    await db.payment_transactions.insert_one(
        {
            "sessionId": session.session_id,
            "userId": str(current_user["_id"]),
            "userEmail": current_user.get("email"),
            "packageId": body.packageId,
            "tier": pkg["tier"],
            "amount": pkg["amount"],
            "currency": pkg["currency"],
            "metadata": {
                "userId": str(current_user["_id"]),
                "packageId": body.packageId,
                "tier": pkg["tier"],
            },
            "status": "initiated",
            "paymentStatus": "unpaid",
            "processed": False,
            "createdAt": datetime.utcnow(),
        }
    )

    return {"url": session.url, "sessionId": session.session_id}


@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    tx = await db.payment_transactions.find_one({"sessionId": session_id})
    if not tx:
        raise HTTPException(404, "Unknown session")

    stripe = _stripe_for_request(request)
    status_resp: CheckoutStatusResponse = await stripe.get_checkout_status(session_id)

    # Idempotent — only grant VIP & mark processed exactly once.
    already_processed = bool(tx.get("processed"))
    is_paid = status_resp.payment_status == "paid" and status_resp.status == "complete"

    update = {
        "status": status_resp.status,
        "paymentStatus": status_resp.payment_status,
        "updatedAt": datetime.utcnow(),
    }
    if is_paid and not already_processed:
        update["processed"] = True
        update["processedAt"] = datetime.utcnow()
        try:
            await _grant_vip_to_user(tx["userId"], tx["tier"], VIP_PACKAGES[tx["packageId"]]["days"])
            update["vipGranted"] = True
        except Exception as e:
            logger.error(f"VIP grant failed for session {session_id}: {e}")

    await db.payment_transactions.update_one({"sessionId": session_id}, {"$set": update})

    return {
        "sessionId": session_id,
        "status": status_resp.status,
        "paymentStatus": status_resp.payment_status,
        "amount": status_resp.amount_total,
        "currency": status_resp.currency,
        "tier": tx["tier"],
        "packageId": tx["packageId"],
        "processed": (already_processed or is_paid),
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Receives Stripe checkout.session.completed and grants VIP idempotently."""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    stripe = _stripe_for_request(request)
    try:
        event = await stripe.handle_webhook(body, signature)
    except Exception as e:
        logger.error(f"Stripe webhook verification failed: {e}")
        raise HTTPException(400, "invalid signature")

    if event.session_id and event.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"sessionId": event.session_id})
        if tx and not tx.get("processed"):
            tier = tx.get("tier") or (event.metadata or {}).get("tier")
            user_id = tx.get("userId") or (event.metadata or {}).get("userId")
            pkg_id = tx.get("packageId") or (event.metadata or {}).get("packageId", "vip_pro")
            days = VIP_PACKAGES.get(pkg_id, {}).get("days", 30)
            try:
                await _grant_vip_to_user(user_id, tier, days)
            except Exception as e:
                logger.error(f"webhook VIP grant failed: {e}")
            await db.payment_transactions.update_one(
                {"sessionId": event.session_id},
                {
                    "$set": {
                        "processed": True,
                        "processedAt": datetime.utcnow(),
                        "paymentStatus": "paid",
                        "status": "complete",
                        "webhookEventId": event.event_id,
                    }
                },
            )
    return {"received": True}
