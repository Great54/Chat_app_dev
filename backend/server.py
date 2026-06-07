from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
from jose import JWTError, jwt
from bson import ObjectId
import os
import logging
from pathlib import Path
import random
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'genc_vibez')]

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app
app = FastAPI(title="GenC Vibez API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
    
    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# ==================== MODELS ====================

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)
    
    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    username: str
    displayName: str

class UserLogin(BaseModel):
    identifier: str  # email OR username
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str

class RoomActivity(BaseModel):
    """Model for room activity feed items"""
    id: str
    roomId: str
    activityType: str  # "post_created", "post_liked", "user_joined", "vip_purchased", "vip_gifted"
    actorId: str
    actorName: str
    actorPhoto: Optional[str] = None
    actorVipTier: Optional[str] = None
    targetId: Optional[str] = None  # For likes: post ID, for gifts: recipient user ID
    targetName: Optional[str] = None  # For gifts: recipient name
    targetPhoto: Optional[str] = None
    metadata: Optional[dict] = None  # Additional data like post text preview, vip tier
    createdAt: datetime

class UserProfile(BaseModel):
    id: str
    email: str
    username: str
    displayName: str
    photoUrl: Optional[str] = None
    bannerUrl: Optional[str] = None
    bio: Optional[str] = ""
    coins: int = 0
    vipTier: Optional[str] = None  # None | "pro" | "elite"
    vouchers: int = 0
    currentRoomId: Optional[str] = None
    onlineStatus: bool = True
    lastSeen: datetime
    createdAt: datetime
    # VIP Pro customizations
    vipBadgeId: Optional[str] = None
    auraType: Optional[str] = None  # glow | sparkle | frame | smoke
    auraColor: Optional[str] = None
    chatColor: Optional[str] = None
    usernameColor: Optional[str] = None
    pmBoxColor: Optional[str] = None
    enlargedAvatar: bool = False
    vipProMonthlyGrantAt: Optional[datetime] = None

class VipProSettings(BaseModel):
    vipBadgeId: Optional[str] = None
    auraType: Optional[str] = None
    auraColor: Optional[str] = None
    chatColor: Optional[str] = None
    usernameColor: Optional[str] = None
    pmBoxColor: Optional[str] = None
    enlargedAvatar: Optional[bool] = None

class UpdateProfile(BaseModel):
    displayName: Optional[str] = None
    photoUrl: Optional[str] = None
    bannerUrl: Optional[str] = None
    bio: Optional[str] = None

class VipPurchase(BaseModel):
    tier: str  # "pro" or "elite"

class DirectMessage(BaseModel):
    receiverId: str
    messageText: str

class DirectMessageResponse(BaseModel):
    id: str
    senderId: str
    senderName: str
    senderPhoto: Optional[str] = None
    receiverId: str
    messageText: str
    createdAt: datetime
    readStatus: bool = False

VIP_TIERS_CONFIG = {
    "pro": {
        "id": "pro",
        "name": "VIP Pro",
        "price": 1000,
        "bonusCoins": 500,
        "voucherDiscount": 10,
        "vouchers": 3,
        "perks": [
            "+500 bonus coins instantly",
            "3 shopping vouchers (10% off)",
            "Golden username badge",
            "Enlarged profile avatar",
            "VIP crown on profile",
        ],
    },
    "elite": {
        "id": "elite",
        "name": "VIP Elite",
        "price": 2500,
        "bonusCoins": 1500,
        "voucherDiscount": 25,
        "vouchers": 8,
        "perks": [
            "+1500 bonus coins instantly",
            "8 premium vouchers (25% off)",
            "Rainbow gradient username",
            "XL avatar with diamond border",
            "Priority game host slots",
            "Exclusive Elite-only emotes",
        ],
    },
}

class RoomCreate(BaseModel):
    roomName: str
    roomCategory: str
    roomDescription: str
    roomBanner: Optional[str] = None

class Room(BaseModel):
    id: str
    roomName: str
    roomCategory: str
    roomDescription: str
    roomBanner: Optional[str] = None
    roomBackground: Optional[str] = None  # Soft/light interior background image
    maxCapacity: int = 36
    currentUserCount: int = 0
    createdBy: str
    createdAt: datetime

class MessageCreate(BaseModel):
    messageText: str

class Message(BaseModel):
    id: str
    roomId: str
    senderId: str
    senderName: str
    senderPhoto: Optional[str] = None
    messageText: str
    createdAt: datetime
    reactions: List[dict] = []

class FriendRequest(BaseModel):
    receiverId: str

class ReportPayload(BaseModel):
    reason: str
    details: Optional[str] = ""

class GiftSendPayload(BaseModel):
    receiverId: str
    giftId: str
    message: Optional[str] = ""

# VIP Pro Badge collection (32 badges) - emoji-based for zero asset cost
VIP_PRO_BADGES = [
    {"id": "badge_lady_vip",   "label": "Lady VIP",     "emoji": "👸",  "bg": "#7c2d12"},
    {"id": "badge_octopus",    "label": "Octopus",      "emoji": "🐙",  "bg": "#581c87"},
    {"id": "badge_skull",      "label": "Skull King",   "emoji": "💀",  "bg": "#1f1f1f"},
    {"id": "badge_bunny",      "label": "Bunny",        "emoji": "🐰",  "bg": "#78350f"},
    {"id": "badge_flowers",    "label": "Flowers",      "emoji": "💐",  "bg": "#86198f"},
    {"id": "badge_cat",        "label": "Cat",          "emoji": "🐱",  "bg": "#a16207"},
    {"id": "badge_giraffe",    "label": "Cool Giraffe", "emoji": "🦒",  "bg": "#854d0e"},
    {"id": "badge_umbrella",   "label": "Magic Umbrella","emoji": "☂️", "bg": "#3730a3"},
    {"id": "badge_detective",  "label": "Detective",    "emoji": "🕵️", "bg": "#171717"},
    {"id": "badge_angel",      "label": "Guardian",     "emoji": "👼",  "bg": "#a16207"},
    {"id": "badge_otter",      "label": "Otter",        "emoji": "🦦",  "bg": "#1e40af"},
    {"id": "badge_witch",      "label": "Witch",        "emoji": "🧙",  "bg": "#581c87"},
    {"id": "badge_heart",      "label": "Sweet Heart",  "emoji": "💗",  "bg": "#fce7f3"},
    {"id": "badge_demon",      "label": "Dark Demon",   "emoji": "👹",  "bg": "#7f1d1d"},
    {"id": "badge_puppy",      "label": "Puppy",        "emoji": "🐶",  "bg": "#fde68a"},
    {"id": "badge_tiger",      "label": "Tiger Cub",    "emoji": "🐯",  "bg": "#fbbf24"},
    {"id": "badge_cross",      "label": "Blessed",      "emoji": "✝️", "bg": "#fbcfe8"},
    {"id": "badge_sword",      "label": "Ice Sword",    "emoji": "⚔️", "bg": "#1e3a8a"},
    {"id": "badge_dog_cool",   "label": "Cool Dog",     "emoji": "🐕",  "bg": "#1e293b"},
    {"id": "badge_frog",       "label": "Rainbow Frog", "emoji": "🐸",  "bg": "#15803d"},
    {"id": "badge_rabbit_punk","label": "Punk Rabbit",  "emoji": "🐇",  "bg": "#0f172a"},
    {"id": "badge_bear",       "label": "Hoodie Bear",  "emoji": "🐻",  "bg": "#0e7490"},
    {"id": "badge_phoenix",    "label": "Phoenix",      "emoji": "🔥",  "bg": "#9a3412"},
    {"id": "badge_rose",       "label": "Rose VIP",     "emoji": "🌹",  "bg": "#831843"},
    {"id": "badge_chest",      "label": "Treasure",     "emoji": "💰",  "bg": "#78350f"},
    {"id": "badge_easter",     "label": "Easter Bunny", "emoji": "🐇",  "bg": "#fef3c7"},
    {"id": "badge_butterfly",  "label": "Butterfly VIP","emoji": "🦋",  "bg": "#7f1d1d"},
    {"id": "badge_shark",      "label": "Shark VIP",    "emoji": "🦈",  "bg": "#0ea5e9"},
    {"id": "badge_bird",       "label": "Kingfisher",   "emoji": "🐦",  "bg": "#0c4a6e"},
    {"id": "badge_mubarak",    "label": "Mubarak",      "emoji": "🕌",  "bg": "#713f12"},
    {"id": "badge_moon",       "label": "Moon VIP",     "emoji": "🌙",  "bg": "#1e3a8a"},
    {"id": "badge_crown",      "label": "Royal Crown",  "emoji": "👑",  "bg": "#3f3f46"},
]

# VIP Elite Badge collection (16 premium badges, distinct from Pro)
VIP_ELITE_BADGES = [
    {"id": "elite_diamond_crown", "label": "Diamond Crown",  "emoji": "👑", "bg": "#1e1b4b"},
    {"id": "elite_phoenix",       "label": "Royal Phoenix",  "emoji": "🦅", "bg": "#7c2d12"},
    {"id": "elite_dragon",        "label": "Eternal Dragon", "emoji": "🐉", "bg": "#581c87"},
    {"id": "elite_star",          "label": "Supernova",      "emoji": "🌟", "bg": "#92400e"},
    {"id": "elite_lightning",     "label": "Stormbringer",   "emoji": "⚡", "bg": "#1e3a8a"},
    {"id": "elite_galaxy",        "label": "Galaxy Lord",    "emoji": "🌌", "bg": "#312e81"},
    {"id": "elite_fire",          "label": "Inferno King",   "emoji": "🔥", "bg": "#7f1d1d"},
    {"id": "elite_diamond",       "label": "Diamond Soul",   "emoji": "💎", "bg": "#0c4a6e"},
    {"id": "elite_unicorn",       "label": "Mythic Unicorn", "emoji": "🦄", "bg": "#831843"},
    {"id": "elite_trophy",        "label": "Eternal Trophy", "emoji": "🏆", "bg": "#854d0e"},
    {"id": "elite_lion",          "label": "Lion of Light",  "emoji": "🦁", "bg": "#78350f"},
    {"id": "elite_wizard",        "label": "Arch Wizard",    "emoji": "🧙‍♂️","bg": "#4c1d95"},
    {"id": "elite_rocket",        "label": "Celestial Ride", "emoji": "🚀", "bg": "#0f172a"},
    {"id": "elite_planet",        "label": "Cosmic Planet",  "emoji": "🪐", "bg": "#1e1b4b"},
    {"id": "elite_sword_gold",    "label": "Golden Blade",   "emoji": "🗡️","bg": "#713f12"},
    {"id": "elite_heart_aura",    "label": "Heart of Aura",  "emoji": "💖", "bg": "#831843"},
]

# Tier configuration — scalable: add more tiers / perks here without changing endpoints
VIP_TIER_CONFIG: Dict[str, Dict[str, Any]] = {
    "pro": {
        "label": "VIP Pro",
        "monthlyCoins": 2000,
        "grantIntervalDays": 30,
        "badgeSets": ["pro"],
        "priorityWelcome": False,
        "welcomeMessage": "",
    },
    "elite": {
        "label": "VIP Elite",
        "monthlyCoins": 3500,
        "grantIntervalDays": 30,
        # Elite users may pick from BOTH badge sets
        "badgeSets": ["pro", "elite"],
        "priorityWelcome": True,
        "welcomeMessage": "👑 An Elite member has entered the room — welcome!",
    },
}

def get_tier_config(tier: Optional[str]) -> Optional[Dict[str, Any]]:
    if not tier:
        return None
    return VIP_TIER_CONFIG.get(tier)

def get_allowed_badge_ids(tier: Optional[str]) -> set:
    cfg = get_tier_config(tier)
    if not cfg:
        return set()
    allowed: set = set()
    for key in cfg["badgeSets"]:
        if key == "pro":
            allowed.update(b["id"] for b in VIP_PRO_BADGES)
        elif key == "elite":
            allowed.update(b["id"] for b in VIP_ELITE_BADGES)
    return allowed

# VIP Pro Aura types
VIP_PRO_AURAS = [
    {"id": "none",    "label": "No Aura"},
    {"id": "glow",    "label": "Glow Aura"},
    {"id": "sparkle", "label": "Sparkle Aura"},
    {"id": "frame",   "label": "Frame Aura"},
    {"id": "smoke",   "label": "Smoke Aura"},
]

# Chat / Username / PM Box color palettes
VIP_PRO_COLORS = {
    "chat": [
        "#FF6B6B", "#F59E0B", "#FBCFE8", "#FDBA74", "#FFFFFF",
        "#FEF08A", "#FCA5A5", "#FBBF24", "#E9D5FF", "#FB923C", "#EC4899",
        "#D946EF", "#EF4444", "#DDD6FE", "#FACC15", "#EAB308", "#BEF264",
        "#D6BCFA", "#F472B6", "#CA8A04", "#D946EF", "#A3E635", "#FCA5A5",
        "#C4B5FD", "#CA8A04", "#67E8F9", "#84CC16", "#A7F3D0", "#BAE6FD",
        "#3B82F6", "#34D399", "#22C55E", "#2DD4BF", "#7C3AED", "#67E8F9",
        "#22C55E", "#06B6D4", "#0EA5E9", "#14B8A6", "#10B981",
    ],
    "username": [
        "#FFFFFF", "#FFD700", "#FF6B9D", "#FF6B6B", "#FACC15", "#FB923C",
        "#22D3EE", "#34D399", "#A78BFA", "#F472B6", "#EF4444", "#10B981",
        "#3B82F6", "#EC4899", "#FBBF24", "#06B6D4",
    ],
    "aura": [
        "#FF6B35", "#EC4899", "#FB923C", "#F59E0B", "#FFFFFF",
        "#DDD6FE", "#D9F99D", "#FDE68A", "#FEF08A", "#F59E0B", "#FBCFE8",
        "#CA8A04", "#BEF264", "#FBCFE8", "#D946EF", "#EF4444", "#E5E7EB",
        "#A7F3D0", "#A3E635", "#67E8F9", "#93C5FD", "#A8A29E", "#F9A8D4",
        "#CA8A04", "#A16207", "#DC2626", "#67E8F9", "#C4B5FD", "#D97706",
        "#7C3AED", "#22C55E", "#B91C1C", "#A3E635", "#BE185D", "#B91C1C",
        "#1D4ED8", "#1E3A8A", "#14532D", "#52525B", "#3F3F46",
        "#0F766E", "#0E7490", "#22C55E", "#22D3EE", "#0EA5E9",
    ],
    "pmBox": [
        "#FBCFE8", "#FFFFFF", "#FEF08A", "#FBBF24", "#FB923C",
        "#E9D5FF", "#FECACA", "#D9F99D", "#BEF264", "#D6BCFA",
        "#BEF264", "#FACA15", "#93C5FD", "#A7F3D0", "#BAE6FD", "#BEF264", "#C4B5FD",
    ],
}

VIP_PRO_MONTHLY_COINS = 2000
VIP_PRO_GRANT_INTERVAL_DAYS = 30

async def maybe_grant_vip_pro_monthly(user: dict) -> Optional[int]:
    """If user is VIP Pro/Elite and the configured interval has passed since the last
    monthly grant, award the tier-appropriate coin amount.
    Returns the granted amount, or None if not granted."""
    tier = user.get("vipTier")
    cfg = get_tier_config(tier)
    if not cfg:
        return None
    monthly_coins = cfg["monthlyCoins"]
    interval_days = cfg["grantIntervalDays"]
    last_grant = user.get("vipProMonthlyGrantAt")
    now = datetime.utcnow()
    if last_grant and (now - last_grant).days < interval_days:
        return None
    user_id = str(user["_id"])
    reason = f"vip_{tier}_monthly"
    description = f"{cfg['label']} monthly bonus"
    await add_coins(user_id, monthly_coins, reason, description)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"vipProMonthlyGrantAt": now}},
    )
    await db.notifications.insert_one({
        "userId": user_id,
        "title": f"💎 {cfg['label']} Monthly Bonus!",
        "body": f"You received {monthly_coins} coins as your {cfg['label']} monthly reward.",
        "type": reason,
        "createdAt": now,
        "readStatus": False,
    })
    return monthly_coins

# Static catalog of gifts (id, name, icon, price in coins)
GIFTS_CATALOG = [
    {"id": "rose",        "name": "Rose",         "icon": "rose",          "price": 10,  "color": "#ec4899"},
    {"id": "heart",       "name": "Heart",        "icon": "heart",         "price": 25,  "color": "#ef4444"},
    {"id": "coffee",      "name": "Coffee",       "icon": "cafe",          "price": 50,  "color": "#a16207"},
    {"id": "cake",        "name": "Birthday Cake","icon": "ice-cream",     "price": 100, "color": "#f59e0b"},
    {"id": "diamond",     "name": "Diamond",      "icon": "diamond",       "price": 250, "color": "#06b6d4"},
    {"id": "crown",       "name": "Royal Crown",  "icon": "trophy",        "price": 500, "color": "#fbbf24"},
    {"id": "rocket",      "name": "Rocket",       "icon": "rocket",        "price": 750, "color": "#8b5cf6"},
    {"id": "sportscar",   "name": "Sports Car",   "icon": "car-sport",     "price": 1500,"color": "#ef4444"},
]

class PredefinedAvatar(BaseModel):
    id: str
    avatarUrl: str
    category: str

# ==================== BOARD POSTS MODELS ====================

class BoardPostCreate(BaseModel):
    text: str
    imageBase64: Optional[str] = None

class BoardCommentCreate(BaseModel):
    text: str

class BoardPostResponse(BaseModel):
    id: str
    roomId: str
    authorId: str
    authorUsername: str
    authorDisplayName: str
    authorPhotoUrl: Optional[str] = None
    authorVipTier: Optional[str] = None
    text: str
    imageBase64: Optional[str] = None
    likesCount: int = 0
    commentsCount: int = 0
    likedByMe: bool = False
    createdAt: datetime

class BoardCommentResponse(BaseModel):
    id: str
    postId: str
    authorId: str
    authorUsername: str
    authorDisplayName: str
    authorPhotoUrl: Optional[str] = None
    authorVipTier: Optional[str] = None
    text: str
    createdAt: datetime

def _build_user_profile(user: dict) -> UserProfile:
    return UserProfile(
        id=str(user["_id"]),
        email=user["email"],
        username=user["username"],
        displayName=user["displayName"],
        photoUrl=user.get("photoUrl"),
        bannerUrl=user.get("bannerUrl"),
        bio=user.get("bio", ""),
        coins=user.get("coins", 0),
        vipTier=user.get("vipTier"),
        vouchers=user.get("vouchers", 0),
        currentRoomId=user.get("currentRoomId"),
        onlineStatus=user.get("onlineStatus", True),
        lastSeen=user.get("lastSeen", datetime.utcnow()),
        createdAt=user.get("createdAt", datetime.utcnow()),
        vipBadgeId=user.get("vipBadgeId"),
        auraType=user.get("auraType"),
        auraColor=user.get("auraColor"),
        chatColor=user.get("chatColor"),
        usernameColor=user.get("usernameColor"),
        pmBoxColor=user.get("pmBoxColor"),
        enlargedAvatar=bool(user.get("enlargedAvatar", False)),
        vipProMonthlyGrantAt=user.get("vipProMonthlyGrantAt"),
    )

# ==================== HELPER FUNCTIONS ====================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    # Serialize ObjectId fields
    user["_id"] = str(user["_id"])
    if user.get("currentRoomId") and ObjectId.is_valid(str(user.get("currentRoomId"))):
        user["currentRoomId"] = str(user["currentRoomId"])
    return dict(user)

def calculate_level(xp: int) -> int:
    return xp // 100

async def add_coins(user_id: str, amount: int, transaction_type: str, description: str):
    """Add coins to user and log transaction"""
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"coins": amount}}
    )
    await db.coin_transactions.insert_one({
        "userId": user_id,
        "amount": amount,
        "type": transaction_type,
        "description": description,
        "createdAt": datetime.utcnow()
    })

async def add_xp(user_id: str, amount: int):
    """Add XP to user and update level"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    new_xp = user.get("xp", 0) + amount
    new_level = calculate_level(new_xp)
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"xp": new_xp, "level": new_level}}
    )

async def create_room_activity(
    room_id: str,
    activity_type: str,
    actor_id: str,
    target_id: Optional[str] = None,
    target_name: Optional[str] = None,
    target_photo: Optional[str] = None,
    metadata: Optional[dict] = None
):
    """Create a room activity for the feed.
    
    Activity types:
    - post_created: User created a new post
    - post_liked: User liked a post
    - user_joined: User joined the room
    - vip_purchased: User purchased VIP
    - vip_gifted: User gifted VIP to another user
    - friend_added: User added someone as friend
    """
    try:
        actor = await db.users.find_one({"_id": ObjectId(actor_id)})
        if not actor:
            return
        
        activity = {
            "roomId": room_id,
            "activityType": activity_type,
            "actorId": actor_id,
            "actorName": actor.get("displayName", "Unknown"),
            "actorPhoto": actor.get("photoUrl"),
            "actorVipTier": actor.get("vipTier"),
            "targetId": target_id,
            "targetName": target_name,
            "targetPhoto": target_photo,
            "metadata": metadata or {},
            "createdAt": datetime.utcnow()
        }
        
        await db.room_activities.insert_one(activity)
    except Exception as e:
        logger.error(f"Failed to create room activity: {e}")

async def _create_activity(
    user_id: str,
    activity_type: str,
    message: str,
    *,
    actor_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    audience: str = "friends",
):
    """Create a feed activity entry.
    user_id  → the subject of the activity (whose feed it shows in by default)
    actor_id → optional: who performed the action (for "X did Y to you" items)
    audience → 'self' (only user sees) | 'friends' (user + their friends see it)
    """
    if not user_id:
        return
    actor_name: Optional[str] = None
    actor_photo: Optional[str] = None
    actor_vip: Optional[str] = None
    if actor_id:
        try:
            actor = await db.users.find_one({"_id": ObjectId(actor_id)})
            if actor:
                actor_name = actor.get("displayName")
                actor_photo = actor.get("photoUrl")
                actor_vip = actor.get("vipTier")
        except Exception:
            pass

    await db.activities.insert_one({
        "userId": user_id,
        "actorId": actor_id,
        "actorName": actor_name,
        "actorPhoto": actor_photo,
        "actorVipTier": actor_vip,
        "type": activity_type,
        "message": message,
        "metadata": metadata or {},
        "audience": audience,
        "createdAt": datetime.utcnow(),
    })

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [
        {"email": user_data.email},
        {"username": user_data.username}
    ]})
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Email or username already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user_doc = {
        "email": user_data.email,
        "password": hashed_password,
        "username": user_data.username,
        "displayName": user_data.displayName,
        "photoUrl": None,
        "bio": "",
        "coins": 100,  # Starting bonus
        "xp": 0,
        "level": 0,
        "achievements": [],
        "currentRoomId": None,
        "onlineStatus": True,
        "lastSeen": datetime.utcnow(),
        "createdAt": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_doc)
    
    # Create token
    access_token = create_access_token({"sub": str(result.inserted_id)})
    
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    identifier = user_data.identifier.strip()
    # Look up user by email OR username (case-insensitive email)
    user = await db.users.find_one({
        "$or": [
            {"email": identifier.lower()},
            {"email": identifier},
            {"username": identifier},
        ]
    })

    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email/username. Please sign up first.")
    
    if not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    
    # Update online status
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"onlineStatus": True, "lastSeen": datetime.utcnow()}}
    )
    
    # Add daily login reward
    last_login = user.get("lastSeen")
    if last_login:
        if (datetime.utcnow() - last_login).days >= 1:
            await add_coins(str(user["_id"]), 50, "daily_login", "Daily login reward")

    # VIP Pro monthly bonus (2000 coins, every 30 days)
    try:
        await maybe_grant_vip_pro_monthly(user)
    except Exception as e:
        logger.error(f"Failed to grant VIP Pro monthly: {e}")

    access_token = create_access_token({"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request a password reset token. 
    The token is logged to console (for testing) - in production, send via email.
    """
    email = request.email.lower().strip()
    
    # Find user by email
    user = await db.users.find_one({"email": email})
    
    # Always return success to prevent email enumeration attacks
    # But only generate token if user exists
    if user:
        # Generate 6-digit token
        token = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        # Store token with 15 minute expiry
        expiry = datetime.utcnow() + timedelta(minutes=15)
        
        await db.password_reset_tokens.update_one(
            {"email": email},
            {
                "$set": {
                    "email": email,
                    "token": token,
                    "expiry": expiry,
                    "used": False,
                    "createdAt": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # Log the token to console (MOCK - replace with email service in production)
        logger.info("=" * 50)
        logger.info(f"PASSWORD RESET TOKEN for {email}: {token}")
        logger.info(f"Token expires at: {expiry}")
        logger.info("=" * 50)
        print(f"\n{'=' * 50}")
        print(f"PASSWORD RESET TOKEN for {email}: {token}")
        print(f"Token expires at: {expiry}")
        print(f"{'=' * 50}\n")
    
    return {"message": "If an account with that email exists, a reset token has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using the token received via email.
    """
    email = request.email.lower().strip()
    token = request.token.strip()
    new_password = request.new_password
    
    # Validate password length
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    # Find the token
    reset_record = await db.password_reset_tokens.find_one({
        "email": email,
        "token": token,
        "used": False
    })
    
    if not reset_record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    if datetime.utcnow() > reset_record["expiry"]:
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
    
    # Find the user
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    # Update the password
    hashed_password = get_password_hash(new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hashed_password}}
    )
    
    # Mark token as used
    await db.password_reset_tokens.update_one(
        {"_id": reset_record["_id"]},
        {"$set": {"used": True}}
    )
    
    logger.info(f"Password reset successful for {email}")
    
    return {"message": "Password has been reset successfully. You can now login with your new password."}

@api_router.get("/auth/me", response_model=UserProfile)
async def get_me(current_user: dict = Depends(get_current_user)):
    return _build_user_profile(current_user)

# ==================== USER ROUTES ====================

@api_router.put("/users/profile", response_model=UserProfile)
async def update_profile(update_data: UpdateProfile, current_user: dict = Depends(get_current_user)):
    update_fields = {}
    if update_data.displayName is not None:
        update_fields["displayName"] = update_data.displayName
    if update_data.photoUrl is not None:
        update_fields["photoUrl"] = update_data.photoUrl
    if update_data.bannerUrl is not None:
        update_fields["bannerUrl"] = update_data.bannerUrl
    if update_data.bio is not None:
        update_fields["bio"] = update_data.bio
    
    if update_fields:
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_fields}
        )
    
    updated_user = await db.users.find_one({"_id": current_user["_id"]})
    return _build_user_profile(updated_user)

@api_router.get("/users/{user_id}", response_model=UserProfile)
async def get_user(user_id: str):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_user_profile(user)

@api_router.get("/users/{user_id}/profile-card")
async def get_profile_card(user_id: str, current_user: dict = Depends(get_current_user)):
    """Rich profile data for the profile popup / profile page.
    Returns user info + friend status + friend count + isBlocked + isSelf."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    me_id = str(current_user["_id"])
    target_id = str(user["_id"])
    is_self = me_id == target_id

    # Friend count for target
    friend_count = await db.friends.count_documents({
        "status": "accepted",
        "$or": [{"senderId": target_id}, {"receiverId": target_id}],
    })

    # Friendship status with current user
    friend_status = "none"
    friend_request_id: Optional[str] = None
    if not is_self:
        friendship = await db.friends.find_one({
            "$or": [
                {"senderId": me_id, "receiverId": target_id},
                {"senderId": target_id, "receiverId": me_id},
            ]
        })
        if friendship:
            friend_request_id = str(friendship["_id"])
            if friendship["status"] == "accepted":
                friend_status = "friends"
            elif friendship["senderId"] == me_id:
                friend_status = "sent"
            else:
                friend_status = "received"

    # Block status — is the current user blocking target?
    is_blocked = await db.user_blocks.find_one({
        "blockerId": me_id,
        "blockedId": target_id,
    }) is not None

    # Badges (computed from vipTier + future achievements)
    badges = []
    vip = user.get("vipTier")
    if vip == "elite":
        badges.append({"id": "elite", "label": "ELITE", "color": "#FF6B9D", "icon": "diamond"})
    elif vip == "pro":
        badges.append({"id": "pro", "label": "PRO", "color": "#FFD700", "icon": "star"})

    # Posts count (across all rooms)
    posts_count = await db.board_posts.count_documents({"authorId": target_id})

    # Profile likes (NEW): "like this user" feature — 1 like per (liker, target).
    # Likes received on the user's POSTS are still kept as `postLikesCount` for legacy.
    likes_count = await db.profile_likes.count_documents({"targetUserId": target_id})
    me_id = str(current_user["_id"])
    has_liked = False
    if me_id != target_id:
        has_liked = bool(await db.profile_likes.find_one({"targetUserId": target_id, "likerId": me_id}))

    # Legacy post-likes aggregate (kept for backwards-compat consumers)
    post_likes_pipeline = [
        {"$match": {"authorId": target_id}},
        {"$project": {"likes_n": {"$size": {"$ifNull": ["$likes", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$likes_n"}}},
    ]
    post_likes_doc = await db.board_posts.aggregate(post_likes_pipeline).to_list(1)
    post_likes_count = post_likes_doc[0]["total"] if post_likes_doc else 0

    return {
        "id": target_id,
        "username": user["username"],
        "displayName": user["displayName"],
        "photoUrl": user.get("photoUrl"),
        "bannerUrl": user.get("bannerUrl"),
        "bio": user.get("bio", ""),
        "vipTier": vip,
        "onlineStatus": user.get("onlineStatus", False),
        "lastSeen": user.get("lastSeen"),
        "createdAt": user.get("createdAt"),
        "coins": user.get("coins", 0),
        "level": user.get("level", 0),
        "badges": badges,
        "friendCount": friend_count,
        "postsCount": posts_count,
        "likesCount": likes_count,
        "postLikesCount": post_likes_count,
        "hasLiked": has_liked,
        "friendStatus": friend_status,
        "friendRequestId": friend_request_id,
        "isBlocked": is_blocked,
        "isSelf": is_self,
        # VIP Pro customization
        "vipBadgeId": user.get("vipBadgeId"),
        "auraType": user.get("auraType"),
        "auraColor": user.get("auraColor"),
        "chatColor": user.get("chatColor"),
        "usernameColor": user.get("usernameColor"),
        "pmBoxColor": user.get("pmBoxColor"),
        "enlargedAvatar": bool(user.get("enlargedAvatar", False)),
    }

@api_router.post("/users/{user_id}/like")
async def like_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle a "profile like" from the current user toward target user.
    Uses an upsert/delete on `profile_likes`; 1 like per (liker, target) pair.
    Idempotent: calling twice in a row just toggles."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")
    me_id = str(current_user["_id"])
    if me_id == user_id:
        raise HTTPException(status_code=400, detail="You can't like your own profile")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.profile_likes.find_one({"targetUserId": user_id, "likerId": me_id})
    if existing:
        await db.profile_likes.delete_one({"_id": existing["_id"]})
        liked = False
    else:
        await db.profile_likes.insert_one({
            "targetUserId": user_id,
            "likerId": me_id,
            "likerName": current_user["displayName"],
            "createdAt": datetime.utcnow(),
        })
        liked = True

    new_count = await db.profile_likes.count_documents({"targetUserId": user_id})
    return {"hasLiked": liked, "likesCount": new_count, "userId": user_id}

@api_router.get("/users/{user_id}/friends")
async def get_user_friends(user_id: str, current_user: dict = Depends(get_current_user), limit: int = 30):
    """List of accepted friends of a given user. Only the user themselves can see this list."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")

    # Privacy: only the user can view their own friends list
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Friends list is private")

    friendships = await db.friends.find({
        "status": "accepted",
        "$or": [{"senderId": user_id}, {"receiverId": user_id}],
    }).to_list(limit)

    friend_ids = []
    for f in friendships:
        friend_ids.append(f["receiverId"] if f["senderId"] == user_id else f["senderId"])

    result = []
    for fid in friend_ids:
        try:
            u = await db.users.find_one({"_id": ObjectId(fid)})
        except Exception:
            continue
        if not u:
            continue
        result.append({
            "id": str(u["_id"]),
            "username": u["username"],
            "displayName": u["displayName"],
            "photoUrl": u.get("photoUrl"),
            "vipTier": u.get("vipTier"),
            "onlineStatus": u.get("onlineStatus", False),
        })
    return result

# ==================== BLOCK / REPORT ====================

@api_router.post("/users/{user_id}/block")
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    me_id = str(current_user["_id"])
    if me_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.user_blocks.update_one(
        {"blockerId": me_id, "blockedId": user_id},
        {"$set": {
            "blockerId": me_id,
            "blockedId": user_id,
            "createdAt": datetime.utcnow(),
        }},
        upsert=True,
    )
    # Also remove any existing friendship
    await db.friends.delete_many({
        "$or": [
            {"senderId": me_id, "receiverId": user_id},
            {"senderId": user_id, "receiverId": me_id},
        ]
    })
    return {"message": "User blocked", "isBlocked": True}

@api_router.delete("/users/{user_id}/block")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    me_id = str(current_user["_id"])
    result = await db.user_blocks.delete_one({"blockerId": me_id, "blockedId": user_id})
    return {"message": "User unblocked", "isBlocked": False, "removed": result.deleted_count}

@api_router.post("/users/{user_id}/report")
async def report_user(user_id: str, payload: ReportPayload, current_user: dict = Depends(get_current_user)):
    me_id = str(current_user["_id"])
    if me_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot report yourself")
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.user_reports.insert_one({
        "reporterId": me_id,
        "reportedId": user_id,
        "reason": payload.reason,
        "details": payload.details or "",
        "createdAt": datetime.utcnow(),
        "status": "open",
    })
    return {"message": "Report submitted. Our team will review it shortly."}

# ==================== GIFTS ====================

@api_router.get("/gifts/catalog")
async def get_gift_catalog():
    return GIFTS_CATALOG

@api_router.post("/gifts/send")
async def send_gift(payload: GiftSendPayload, current_user: dict = Depends(get_current_user)):
    me_id = str(current_user["_id"])
    if me_id == payload.receiverId:
        raise HTTPException(status_code=400, detail="You cannot send a gift to yourself")

    gift = next((g for g in GIFTS_CATALOG if g["id"] == payload.giftId), None)
    if not gift:
        raise HTTPException(status_code=400, detail="Invalid gift")

    receiver = await db.users.find_one({"_id": ObjectId(payload.receiverId)})
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")

    if current_user.get("coins", 0) < gift["price"]:
        raise HTTPException(
            status_code=400,
            detail=f"Need {gift['price']} coins (you have {current_user.get('coins', 0)})",
        )

    # Deduct coins from sender
    await add_coins(me_id, -gift["price"], "gift_sent", f"Sent {gift['name']} to {receiver['displayName']}")

    # Log gift
    await db.gifts.insert_one({
        "senderId": me_id,
        "senderName": current_user["displayName"],
        "senderPhoto": current_user.get("photoUrl"),
        "receiverId": payload.receiverId,
        "giftId": gift["id"],
        "giftName": gift["name"],
        "giftIcon": gift["icon"],
        "giftColor": gift.get("color"),
        "price": gift["price"],
        "message": payload.message or "",
        "createdAt": datetime.utcnow(),
    })

    # Notify receiver
    await db.notifications.insert_one({
        "userId": payload.receiverId,
        "title": f"🎁 You received a {gift['name']}!",
        "body": f"{current_user['displayName']} sent you a {gift['name']}",
        "type": "gift",
        "relatedUserId": me_id,
        "createdAt": datetime.utcnow(),
        "readStatus": False,
    })

    # Feed activities
    await _create_activity(
        user_id=payload.receiverId,
        actor_id=me_id,
        activity_type="gift_received",
        message=f"received a {gift['name']} from {current_user['displayName']}",
        metadata={
            "giftId": gift["id"],
            "giftName": gift["name"],
            "giftIcon": gift["icon"],
            "giftColor": gift.get("color"),
            "price": gift["price"],
        },
        audience="friends",
    )
    await _create_activity(
        user_id=me_id,
        actor_id=payload.receiverId,
        activity_type="gift_sent",
        message=f"sent a {gift['name']} to {receiver['displayName']}",
        metadata={
            "giftId": gift["id"],
            "giftName": gift["name"],
            "giftIcon": gift["icon"],
            "giftColor": gift.get("color"),
            "price": gift["price"],
            "receiverName": receiver['displayName'],
            "receiverPhoto": receiver.get("photoUrl"),
        },
        audience="self",
    )

    # Also log to room feed if sender is in a room
    current_room_id = current_user.get("currentRoomId")
    if current_room_id:
        await create_room_activity(
            room_id=current_room_id,
            activity_type="vip_gifted",
            actor_id=me_id,
            target_id=payload.receiverId,
            target_name=receiver.get("displayName"),
            target_photo=receiver.get("photoUrl"),
            metadata={
                "giftId": gift["id"],
                "giftName": gift["name"],
                "giftIcon": gift["icon"]
            }
        )

    return {
        "message": f"Sent {gift['name']} to {receiver['displayName']}",
        "gift": gift,
        "remainingCoins": current_user.get("coins", 0) - gift["price"],
    }

# ==================== FEED ====================

@api_router.get("/feed")
async def get_feed(
    limit: int = 30,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Return feed items for the current user.
    Includes: my own activities (all audiences) + friends' activities where audience='friends'.
    Newest first. Supports cursor pagination via `before` (ISO timestamp).
    """
    me_id = str(current_user["_id"])

    # Get friend ids
    friendships = await db.friends.find({
        "status": "accepted",
        "$or": [{"senderId": me_id}, {"receiverId": me_id}],
    }).to_list(500)
    friend_ids = [
        f["receiverId"] if f["senderId"] == me_id else f["senderId"]
        for f in friendships
    ]

    query: Dict[str, Any] = {
        "$or": [
            {"userId": me_id},  # my own activities
            {"userId": {"$in": friend_ids}, "audience": "friends"},
        ],
    }
    if before:
        try:
            query["createdAt"] = {"$lt": datetime.fromisoformat(before.replace("Z", "+00:00")).replace(tzinfo=None)}
        except Exception:
            pass

    items = await db.activities.find(query).sort("createdAt", -1).limit(min(limit, 100)).to_list(limit)

    # Build subject (user) info map
    user_ids = list({i["userId"] for i in items})
    users_map: Dict[str, dict] = {}
    for uid in user_ids:
        try:
            u = await db.users.find_one({"_id": ObjectId(uid)})
            if u:
                users_map[uid] = {
                    "id": str(u["_id"]),
                    "username": u["username"],
                    "displayName": u["displayName"],
                    "photoUrl": u.get("photoUrl"),
                    "vipTier": u.get("vipTier"),
                }
        except Exception:
            continue

    result = []
    for it in items:
        subject = users_map.get(it["userId"], {})
        result.append({
            "id": str(it["_id"]),
            "type": it["type"],
            "message": it["message"],
            "metadata": it.get("metadata", {}),
            "audience": it.get("audience", "friends"),
            "createdAt": it["createdAt"].isoformat() + "Z",
            "user": subject,
            "actor": {
                "id": it.get("actorId"),
                "displayName": it.get("actorName"),
                "photoUrl": it.get("actorPhoto"),
                "vipTier": it.get("actorVipTier"),
            } if it.get("actorId") else None,
            "isOwn": it["userId"] == me_id,
        })
    return result

@api_router.get("/feed/unread-count")
async def get_feed_unread_count(current_user: dict = Depends(get_current_user)):
    """Number of feed items newer than user's last seen timestamp."""
    me_id = str(current_user["_id"])
    last_seen = current_user.get("feedLastSeenAt") or datetime.utcfromtimestamp(0)

    friendships = await db.friends.find({
        "status": "accepted",
        "$or": [{"senderId": me_id}, {"receiverId": me_id}],
    }).to_list(500)
    friend_ids = [
        f["receiverId"] if f["senderId"] == me_id else f["senderId"]
        for f in friendships
    ]

    count = await db.activities.count_documents({
        "$or": [
            {"userId": me_id},
            {"userId": {"$in": friend_ids}, "audience": "friends"},
        ],
        "createdAt": {"$gt": last_seen},
        "actorId": {"$ne": me_id},  # don't count actions I initiated
    })
    return {"count": count}

@api_router.post("/feed/mark-seen")
async def mark_feed_seen(current_user: dict = Depends(get_current_user)):
    """Mark the current time as the feed last-seen for the user."""
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"feedLastSeenAt": datetime.utcnow()}},
    )
    return {"message": "ok"}

@api_router.get("/avatars/predefined")
async def get_predefined_avatars():
    """Get predefined avatars - returns sample placeholder list"""
    avatars = [
        {
            "id": f"avatar_{i}",
            "category": "default",
            "avatarUrl": f"https://api.dicebear.com/7.x/avataaars/svg?seed=avatar_{i}",
        }
        for i in range(1, 9)
    ]
    return avatars

# ==================== ROOM ROUTES ====================

@api_router.get("/rooms")
async def get_rooms():
    rooms = await db.rooms.find().to_list(100)
    return [
        Room(
            id=str(room["_id"]),
            roomName=room["roomName"],
            roomCategory=room["roomCategory"],
            roomDescription=room["roomDescription"],
            roomBanner=room.get("roomBanner"),
            roomBackground=room.get("roomBackground"),
            maxCapacity=room.get("maxCapacity", 36),
            currentUserCount=room.get("currentUserCount", 0),
            createdBy=room["createdBy"],
            createdAt=room["createdAt"]
        ) for room in rooms
    ]


@api_router.post("/rooms/{room_id}/favorite")
async def toggle_favorite_room(room_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle room in current user's favorites list."""
    room = await db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    favorites = current_user.get("favoriteRoomIds", []) or []
    if room_id in favorites:
        favorites = [r for r in favorites if r != room_id]
        is_favorite = False
    else:
        favorites = favorites + [room_id]
        is_favorite = True
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"favoriteRoomIds": favorites}},
    )
    return {"isFavorite": is_favorite, "favoriteRoomIds": favorites}


@api_router.get("/users/me/favorites")
async def get_my_favorite_rooms(current_user: dict = Depends(get_current_user)):
    """Return the list of room ids the current user has favorited."""
    return {"favoriteRoomIds": current_user.get("favoriteRoomIds", []) or []}

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, current_user: dict = Depends(get_current_user)):
    room = await db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check capacity
    current_count = room.get("currentUserCount", 0)
    if current_count >= room.get("maxCapacity", 36):
        raise HTTPException(status_code=400, detail="Room is full")
    
    # Leave current room if in one
    current_room_id = current_user.get("currentRoomId")
    if current_room_id:
        await leave_room_helper(current_room_id, str(current_user["_id"]))
    
    # Join new room
    user_id = str(current_user["_id"])
    
    # Add to room_members
    await db.room_members.update_one(
        {"userId": user_id, "roomId": room_id},
        {"$set": {
            "userId": user_id,
            "roomId": room_id,
            "joinedAt": datetime.utcnow(),
            "username": current_user["username"],
            "profilePhoto": current_user.get("photoUrl"),
            "level": current_user.get("level", 0),
            "onlineStatus": True
        }},
        upsert=True
    )
    
    # Update room count
    await db.rooms.update_one(
        {"_id": ObjectId(room_id)},
        {"$inc": {"currentUserCount": 1}}
    )
    
    # Update user's current room + track last visited room
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"currentRoomId": room_id, "lastRoomId": room_id}}
    )
    
    # Add room join reward
    await add_coins(user_id, 10, "room_join", f"Joined {room['roomName']}")
    
    # Broadcast room update
    await manager.broadcast(room_id, {
        "type": "user_joined",
        "userId": user_id,
        "username": current_user["username"]
    })

    # Elite priority welcome — broadcast a separate, non-blocking welcome event
    tier = current_user.get("vipTier")
    tier_cfg = get_tier_config(tier)
    if tier_cfg and tier_cfg.get("priorityWelcome"):
        welcome_doc = {
            "roomId": room_id,
            "tier": tier,
            "tierLabel": tier_cfg["label"],
            "userId": user_id,
            "username": current_user["username"],
            "displayName": current_user.get("displayName") or current_user["username"],
            "photoUrl": current_user.get("photoUrl"),
            "vipBadgeId": current_user.get("vipBadgeId"),
            "auraType": current_user.get("auraType"),
            "auraColor": current_user.get("auraColor"),
            "usernameColor": current_user.get("usernameColor"),
            "message": tier_cfg.get("welcomeMessage", ""),
            "durationMs": 4000,
            "createdAt": datetime.utcnow(),
        }
        await db.elite_welcomes.insert_one(welcome_doc)
        # Best-effort WS broadcast (in case other clients subscribe later)
        await manager.broadcast(room_id, {
            "type": "vip_priority_welcome",
            **{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in welcome_doc.items() if k != "_id"},
        })

    return {"message": "Joined room successfully"}

async def leave_room_helper(room_id: str, user_id: str):
    """Helper function to leave a room (only decrements if user was actually in room)"""
    # Only proceed if user is actually a member
    result = await db.room_members.delete_one({"userId": user_id, "roomId": room_id})
    
    if result.deleted_count > 0:
        # Decrement count but never below 0
        await db.rooms.update_one(
            {"_id": ObjectId(room_id), "currentUserCount": {"$gt": 0}},
            {"$inc": {"currentUserCount": -1}}
        )
        
        # Broadcast room update
        await manager.broadcast(room_id, {
            "type": "user_left",
            "userId": user_id
        })

@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    await leave_room_helper(room_id, user_id)
    
    # Update user's current room (keep lastRoomId so they can be auto-rejoined on next login)
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"currentRoomId": None, "lastRoomId": room_id}}
    )
    
    return {"message": "Left room successfully"}

@api_router.post("/rooms/auto-join")
async def auto_join_room(current_user: dict = Depends(get_current_user)):
    """Auto-join the user into a room:
    1. Try last visited room (if not full)
    2. Else try World Vibez
    3. Else first available non-full room
    Returns: { roomId, roomName, wasResumed: bool }
    """
    user_id = str(current_user["_id"])
    last_room_id = current_user.get("lastRoomId")

    candidate = None
    was_resumed = False

    # 1. Last room
    if last_room_id and ObjectId.is_valid(str(last_room_id)):
        room = await db.rooms.find_one({"_id": ObjectId(last_room_id)})
        if room and room.get("currentUserCount", 0) < room.get("maxCapacity", 36):
            candidate = room
            was_resumed = True

    # 2. World Vibez
    if not candidate:
        room = await db.rooms.find_one({"roomName": "World Vibez"})
        if room and room.get("currentUserCount", 0) < room.get("maxCapacity", 36):
            candidate = room

    # 3. Any non-full room
    if not candidate:
        all_rooms = await db.rooms.find().to_list(100)
        for r in all_rooms:
            if r.get("currentUserCount", 0) < r.get("maxCapacity", 36):
                candidate = r
                break

    if not candidate:
        raise HTTPException(status_code=503, detail="All rooms are full. Try again later.")

    room_id = str(candidate["_id"])

    # Leave current room if user is in one (different from candidate)
    current_room_id = current_user.get("currentRoomId")
    if current_room_id and current_room_id != room_id:
        await leave_room_helper(current_room_id, user_id)

    # Join the candidate room (skip if already member)
    existing = await db.room_members.find_one({"userId": user_id, "roomId": room_id})
    if not existing:
        await db.room_members.update_one(
            {"userId": user_id, "roomId": room_id},
            {"$set": {
                "userId": user_id,
                "roomId": room_id,
                "joinedAt": datetime.utcnow(),
                "username": current_user["username"],
                "profilePhoto": current_user.get("photoUrl"),
                "level": current_user.get("level", 0),
                "onlineStatus": True,
            }},
            upsert=True,
        )
        await db.rooms.update_one(
            {"_id": candidate["_id"]},
            {"$inc": {"currentUserCount": 1}}
        )

    # Track current + last room
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"currentRoomId": room_id, "lastRoomId": room_id}}
    )

    return {
        "roomId": room_id,
        "roomName": candidate["roomName"],
        "wasResumed": was_resumed,
    }

@api_router.get("/rooms/{room_id}/priority-welcomes")
async def get_priority_welcomes(room_id: str, since_ms: int = 6000):
    """Return active VIP Elite priority welcome notifications for a room
    that were created within the last `since_ms` milliseconds (default 6s)."""
    cutoff = datetime.utcnow() - timedelta(milliseconds=max(1000, min(since_ms, 60000)))
    docs = await db.elite_welcomes.find({
        "roomId": room_id,
        "createdAt": {"$gte": cutoff},
    }).sort("createdAt", -1).to_list(20)
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "tier": d.get("tier"),
            "tierLabel": d.get("tierLabel"),
            "userId": d.get("userId"),
            "username": d.get("username"),
            "displayName": d.get("displayName"),
            "photoUrl": d.get("photoUrl"),
            "vipBadgeId": d.get("vipBadgeId"),
            "auraType": d.get("auraType"),
            "auraColor": d.get("auraColor"),
            "usernameColor": d.get("usernameColor"),
            "message": d.get("message", ""),
            "durationMs": d.get("durationMs", 4000),
            "createdAt": d.get("createdAt").isoformat() if d.get("createdAt") else None,
        })
    return result

@api_router.get("/rooms/{room_id}/members")
async def get_room_members(room_id: str):
    members = await db.room_members.find({"roomId": room_id}).to_list(36)
    # Enrich with current vipTier from users collection
    enriched = []
    for member in members:
        user_doc = await db.users.find_one({"_id": ObjectId(member["userId"])})
        enriched.append({
            "userId": member["userId"],
            "username": member["username"],
            "profilePhoto": user_doc.get("photoUrl") if user_doc else member.get("profilePhoto"),
            "vipTier": user_doc.get("vipTier") if user_doc else None,
            "vipBadgeId": user_doc.get("vipBadgeId") if user_doc else None,
            "auraType": user_doc.get("auraType") if user_doc else None,
            "auraColor": user_doc.get("auraColor") if user_doc else None,
            "usernameColor": user_doc.get("usernameColor") if user_doc else None,
            "enlargedAvatar": bool(user_doc.get("enlargedAvatar", False)) if user_doc else False,
            "onlineStatus": member.get("onlineStatus", True)
        })
    return enriched

@api_router.get("/rooms/{room_id}/activities")
async def get_room_activities(room_id: str, limit: int = 50, skip: int = 0):
    """Get activity feed for a room"""
    activities = await db.room_activities.find(
        {"roomId": room_id}
    ).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    
    return [
        {
            "id": str(activity["_id"]),
            "roomId": activity["roomId"],
            "activityType": activity["activityType"],
            "actorId": activity["actorId"],
            "actorName": activity["actorName"],
            "actorPhoto": activity.get("actorPhoto"),
            "actorVipTier": activity.get("actorVipTier"),
            "targetId": activity.get("targetId"),
            "targetName": activity.get("targetName"),
            "targetPhoto": activity.get("targetPhoto"),
            "metadata": activity.get("metadata", {}),
            "createdAt": activity["createdAt"],
        }
        for activity in activities
    ]

# ==================== MESSAGE ROUTES ====================

@api_router.get("/messages/{room_id}")
async def get_messages(room_id: str, limit: int = 50):
    messages = await db.messages.find({"roomId": room_id}).sort("createdAt", -1).limit(limit).to_list(limit)
    messages.reverse()

    # Bulk-load sender user docs to attach VIP customizations
    sender_ids = list({msg["senderId"] for msg in messages if msg.get("senderId") and msg["senderId"] != "system"})
    senders_map: Dict[str, dict] = {}
    for sid in sender_ids:
        try:
            u = await db.users.find_one({"_id": ObjectId(sid)})
            if u:
                senders_map[sid] = u
        except Exception:
            pass

    result = []
    for msg in messages:
        sender = senders_map.get(msg.get("senderId"), {})
        result.append({
            "id": str(msg["_id"]),
            "roomId": msg["roomId"],
            "senderId": msg["senderId"],
            "senderName": msg["senderName"],
            "senderPhoto": sender.get("photoUrl") or msg.get("senderPhoto"),
            "messageText": msg["messageText"],
            "createdAt": msg["createdAt"],
            "reactions": msg.get("reactions", []),
            "senderVipTier": sender.get("vipTier"),
            "senderVipBadgeId": sender.get("vipBadgeId"),
            "senderAuraType": sender.get("auraType"),
            "senderAuraColor": sender.get("auraColor"),
            "senderChatColor": sender.get("chatColor"),
            "senderUsernameColor": sender.get("usernameColor"),
            "senderEnlargedAvatar": bool(sender.get("enlargedAvatar", False)),
        })
    return result

@api_router.post("/messages/{room_id}")
async def send_message(room_id: str, message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    # Check if user is in the room
    if current_user.get("currentRoomId") != room_id:
        raise HTTPException(status_code=403, detail="You must be in the room to send messages")
    
    user_id = str(current_user["_id"])
    
    # Create message
    message_doc = {
        "roomId": room_id,
        "senderId": user_id,
        "senderName": current_user["displayName"],
        "senderPhoto": current_user.get("photoUrl"),
        "messageText": message_data.messageText,
        "createdAt": datetime.utcnow(),
        "reactions": []
    }
    
    result = await db.messages.insert_one(message_doc)
    
    # Check if user should get coin reward (every 10 messages)
    message_count = await db.messages.count_documents({"senderId": user_id})
    if message_count % 10 == 0:
        await add_coins(user_id, 5, "chat", "Active participation reward")
    
    # Broadcast message
    message_obj = {
        "id": str(result.inserted_id),
        "roomId": room_id,
        "senderId": user_id,
        "senderName": current_user["displayName"],
        "senderPhoto": current_user.get("photoUrl"),
        "messageText": message_data.messageText,
        "createdAt": message_doc["createdAt"].isoformat(),
        "reactions": [],
        "senderVipTier": current_user.get("vipTier"),
        "senderVipBadgeId": current_user.get("vipBadgeId"),
        "senderAuraType": current_user.get("auraType"),
        "senderAuraColor": current_user.get("auraColor"),
        "senderChatColor": current_user.get("chatColor"),
        "senderUsernameColor": current_user.get("usernameColor"),
        "senderEnlargedAvatar": bool(current_user.get("enlargedAvatar", False)),
    }

    await manager.broadcast(room_id, {
        "type": "new_message",
        "message": message_obj
    })

    return message_obj

# ==================== PRIVATE MESSAGING ROUTES ====================

@api_router.post("/messages/direct/send")
async def send_direct_message(message_data: DirectMessage, current_user: dict = Depends(get_current_user)):
    """Send a private message to another user"""
    sender_id = str(current_user["_id"])
    receiver_id = message_data.receiverId
    
    # Verify receiver exists
    receiver = await db.users.find_one({"_id": ObjectId(receiver_id)})
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent sending message to self
    if sender_id == receiver_id:
        raise HTTPException(status_code=400, detail="Cannot send message to yourself")
    
    # Create direct message
    dm_doc = {
        "senderId": sender_id,
        "senderName": current_user["displayName"],
        "senderPhoto": current_user.get("photoUrl"),
        "receiverId": receiver_id,
        "messageText": message_data.messageText,
        "createdAt": datetime.utcnow(),
        "readStatus": False
    }
    
    result = await db.direct_messages.insert_one(dm_doc)
    
    # Create notification for receiver
    await db.notifications.insert_one({
        "userId": receiver_id,
        "title": "New Message",
        "body": f"{current_user['displayName']} sent you a message",
        "type": "direct_message",
        "relatedUserId": sender_id,
        "createdAt": datetime.utcnow(),
        "readStatus": False
    })
    
    return DirectMessageResponse(
        id=str(result.inserted_id),
        senderId=sender_id,
        senderName=current_user["displayName"],
        senderPhoto=current_user.get("photoUrl"),
        receiverId=receiver_id,
        messageText=message_data.messageText,
        createdAt=dm_doc["createdAt"],
        readStatus=False
    )

@api_router.get("/messages/direct/{user_id}")
async def get_direct_messages(user_id: str, current_user: dict = Depends(get_current_user), limit: int = 50):
    """Get conversation with a specific user"""
    current_user_id = str(current_user["_id"])
    
    # Get all messages between the two users
    messages = await db.direct_messages.find({
        "$or": [
            {"senderId": current_user_id, "receiverId": user_id},
            {"senderId": user_id, "receiverId": current_user_id}
        ]
    }).sort("createdAt", -1).limit(limit).to_list(limit)
    
    messages.reverse()
    
    # Mark messages as read if they're directed to current user
    await db.direct_messages.update_many(
        {"senderId": user_id, "receiverId": current_user_id, "readStatus": False},
        {"$set": {"readStatus": True}}
    )

    # Load other user's customizations once
    other_user = None
    try:
        other_user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        pass
    other_pm_color = other_user.get("pmBoxColor") if other_user else None
    other_chat_color = other_user.get("chatColor") if other_user else None
    other_username_color = other_user.get("usernameColor") if other_user else None
    self_pm_color = current_user.get("pmBoxColor")
    self_chat_color = current_user.get("chatColor")
    self_username_color = current_user.get("usernameColor")

    result = []
    for msg in messages:
        is_self = msg["senderId"] == current_user_id
        result.append({
            "id": str(msg["_id"]),
            "senderId": msg["senderId"],
            "senderName": msg["senderName"],
            "senderPhoto": msg.get("senderPhoto"),
            "receiverId": msg["receiverId"],
            "messageText": msg["messageText"],
            "createdAt": msg["createdAt"],
            "readStatus": msg.get("readStatus", False),
            "senderPmBoxColor": self_pm_color if is_self else other_pm_color,
            "senderChatColor": self_chat_color if is_self else other_chat_color,
            "senderUsernameColor": self_username_color if is_self else other_username_color,
        })
    return result

@api_router.get("/messages/direct/conversations/list")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get list of all conversations (most recent first) with unread counts"""
    current_user_id = str(current_user["_id"])
    
    # Get unique users we've messaged
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"senderId": current_user_id},
                    {"receiverId": current_user_id}
                ]
            }
        },
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$senderId", current_user_id]},
                        "$receiverId",
                        "$senderId"
                    ]
                },
                "lastMessage": {"$max": "$createdAt"},
                "lastMessageText": {"$last": "$messageText"},
                "unreadCount": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$eq": ["$receiverId", current_user_id]},
                                    {"$eq": ["$readStatus", False]}
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {"$sort": {"lastMessage": -1}}
    ]
    
    conversations = await db.direct_messages.aggregate(pipeline).to_list(None)
    
    # Enrich with user details
    enriched = []
    for conv in conversations:
        user = await db.users.find_one({"_id": ObjectId(conv["_id"])})
        if user:
            enriched.append({
                "userId": str(user["_id"]),
                "username": user["username"],
                "displayName": user["displayName"],
                "photoUrl": user.get("photoUrl"),
                "lastMessage": conv.get("lastMessageText", ""),
                "lastMessageTime": conv.get("lastMessage"),
                "unreadCount": conv.get("unreadCount", 0),
                "onlineStatus": user.get("onlineStatus", False)
            })
    
    return enriched


@api_router.get("/messages/direct/unread/total")
async def get_dm_unread_total(current_user: dict = Depends(get_current_user)):
    """Total number of unread direct messages addressed to the current user."""
    me_id = str(current_user["_id"])
    count = await db.direct_messages.count_documents({
        "receiverId": me_id,
        "readStatus": False,
    })
    return {"unreadCount": count}


@api_router.delete("/messages/direct/conversation/{user_id}")
async def delete_dm_conversation(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete the entire DM conversation between current user and `user_id`
    for the current user (hard delete is fine here as both ends share the row;
    we delete all rows between the two)."""
    me_id = str(current_user["_id"])
    result = await db.direct_messages.delete_many({
        "$or": [
            {"senderId": me_id, "receiverId": user_id},
            {"senderId": user_id, "receiverId": me_id},
        ]
    })
    return {"deleted": result.deleted_count}


class DmSettings(BaseModel):
    allowMessagesFrom: Optional[str] = None  # "everyone" | "friends" | "nobody"
    notificationsEnabled: Optional[bool] = None


@api_router.get("/users/me/dm-settings")
async def get_dm_settings(current_user: dict = Depends(get_current_user)):
    return {
        "allowMessagesFrom": current_user.get("allowMessagesFrom", "everyone"),
        "notificationsEnabled": bool(current_user.get("dmNotificationsEnabled", True)),
        "blockedUserIds": current_user.get("blockedUserIds", []) or [],
    }


@api_router.put("/users/me/dm-settings")
async def update_dm_settings(payload: DmSettings, current_user: dict = Depends(get_current_user)):
    update: Dict[str, Any] = {}
    if payload.allowMessagesFrom in {"everyone", "friends", "nobody"}:
        update["allowMessagesFrom"] = payload.allowMessagesFrom
    if payload.notificationsEnabled is not None:
        update["dmNotificationsEnabled"] = bool(payload.notificationsEnabled)
    if update:
        await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$set": update})
    return {"ok": True, **update}


# ==================== WEBSOCKET ====================

@app.websocket("/ws/room/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            _ = await websocket.receive_text()
            # Keep connection alive
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

# ==================== COINS & XP ====================

@api_router.get("/coins/transactions")
async def get_coin_transactions(current_user: dict = Depends(get_current_user), limit: int = 50):
    transactions = await db.coin_transactions.find(
        {"userId": str(current_user["_id"])}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return [
        {
            "id": str(tx["_id"]),
            "amount": tx["amount"],
            "type": tx["type"],
            "description": tx["description"],
            "createdAt": tx["createdAt"]
        } for tx in transactions
    ]

@api_router.post("/coins/daily-reward")
async def claim_daily_reward(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    last_seen = current_user.get("lastSeen", datetime.utcnow())
    
    # Check if already claimed today
    if (datetime.utcnow() - last_seen).total_seconds() < 86400:  # 24 hours
        raise HTTPException(status_code=400, detail="Daily reward already claimed")
    
    await add_coins(user_id, 50, "daily_login", "Daily login bonus")
    await _create_activity(
        user_id=user_id,
        actor_id=None,
        activity_type="coins_received",
        message="claimed 50 daily login coins",
        metadata={"amount": 50, "source": "daily_login"},
        audience="self",
    )
    return {"message": "Daily reward claimed", "coins": 50}

# ==================== FRIENDS ====================

@api_router.post("/friends/request")
async def send_friend_request(friend_req: FriendRequest, current_user: dict = Depends(get_current_user)):
    sender_id = str(current_user["_id"])
    receiver_id = friend_req.receiverId
    
    # Check if already friends or request exists
    existing = await db.friends.find_one({
        "$or": [
            {"senderId": sender_id, "receiverId": receiver_id},
            {"senderId": receiver_id, "receiverId": sender_id}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    await db.friends.insert_one({
        "senderId": sender_id,
        "receiverId": receiver_id,
        "status": "pending",
        "createdAt": datetime.utcnow()
    })
    
    # Create notification
    await db.notifications.insert_one({
        "userId": receiver_id,
        "title": "New Friend Request",
        "body": f"{current_user['displayName']} sent you a friend request",
        "type": "friend_request",
        "createdAt": datetime.utcnow(),
        "readStatus": False
    })

    # Feed activity for the receiver (self-only — they should see it in their own feed)
    await _create_activity(
        user_id=receiver_id,
        actor_id=sender_id,
        activity_type="friend_request_received",
        message=f"{current_user['displayName']} sent you a friend request",
        metadata={
            "senderId": sender_id,
            "senderName": current_user['displayName'],
            "senderPhoto": current_user.get("photoUrl"),
        },
        audience="self",
    )

    return {"message": "Friend request sent"}

@api_router.post("/friends/accept/{request_id}")
async def accept_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    friend_req = await db.friends.find_one({"_id": ObjectId(request_id)})
    if not friend_req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friend_req["receiverId"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.friends.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "accepted"}}
    )
    
    # Notify sender that request was accepted
    await db.notifications.insert_one({
        "userId": friend_req["senderId"],
        "title": "Friend Request Accepted",
        "body": f"{current_user['displayName']} accepted your friend request",
        "type": "friend_accepted",
        "createdAt": datetime.utcnow(),
        "readStatus": False
    })

    # Feed activity for both sides (visible to friends → social)
    sender_user = await db.users.find_one({"_id": ObjectId(friend_req["senderId"])})
    sender_name = sender_user.get("displayName", "Someone") if sender_user else "Someone"
    await _create_activity(
        user_id=friend_req["senderId"],
        actor_id=str(current_user["_id"]),
        activity_type="friend_added",
        message=f"became friends with {current_user['displayName']}",
        metadata={
            "friendId": str(current_user["_id"]),
            "friendName": current_user['displayName'],
            "friendPhoto": current_user.get("photoUrl"),
        },
        audience="friends",
    )
    await _create_activity(
        user_id=str(current_user["_id"]),
        actor_id=friend_req["senderId"],
        activity_type="friend_added",
        message=f"became friends with {sender_name}",
        metadata={
            "friendId": friend_req["senderId"],
            "friendName": sender_name,
            "friendPhoto": sender_user.get("photoUrl") if sender_user else None,
        },
        audience="friends",
    )

    return {"message": "Friend request accepted"}

@api_router.get("/friends/list")
async def get_friends(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    
    friends = await db.friends.find({
        "$or": [{"senderId": user_id}, {"receiverId": user_id}],
        "status": "accepted"
    }).to_list(100)
    
    friend_ids = []
    for friend in friends:
        if friend["senderId"] == user_id:
            friend_ids.append(friend["receiverId"])
        else:
            friend_ids.append(friend["senderId"])
    
    # Get user details
    friend_users = []
    for friend_id in friend_ids:
        user = await db.users.find_one({"_id": ObjectId(friend_id)})
        if user:
            friend_users.append({
                "id": str(user["_id"]),
                "username": user["username"],
                "displayName": user["displayName"],
                "photoUrl": user.get("photoUrl"),
                "level": user.get("level", 0),
                "onlineStatus": user.get("onlineStatus", False)
            })
    
    return friend_users

@api_router.get("/friends/pending")
async def get_pending_requests(current_user: dict = Depends(get_current_user)):
    """Get friend requests received by current user (pending)"""
    user_id = str(current_user["_id"])
    
    pending = await db.friends.find({
        "receiverId": user_id,
        "status": "pending"
    }).to_list(100)
    
    requests = []
    for req in pending:
        sender = await db.users.find_one({"_id": ObjectId(req["senderId"])})
        if sender:
            requests.append({
                "requestId": str(req["_id"]),
                "senderId": str(sender["_id"]),
                "username": sender["username"],
                "displayName": sender["displayName"],
                "photoUrl": sender.get("photoUrl"),
                "level": sender.get("level", 0),
                "createdAt": req["createdAt"]
            })
    
    return requests

@api_router.get("/friends/sent")
async def get_sent_requests(current_user: dict = Depends(get_current_user)):
    """Get friend requests sent by current user (pending)"""
    user_id = str(current_user["_id"])
    
    sent = await db.friends.find({
        "senderId": user_id,
        "status": "pending"
    }).to_list(100)
    
    requests = []
    for req in sent:
        receiver = await db.users.find_one({"_id": ObjectId(req["receiverId"])})
        if receiver:
            requests.append({
                "requestId": str(req["_id"]),
                "receiverId": str(receiver["_id"]),
                "username": receiver["username"],
                "displayName": receiver["displayName"],
                "photoUrl": receiver.get("photoUrl"),
                "level": receiver.get("level", 0),
                "createdAt": req["createdAt"]
            })
    
    return requests

@api_router.post("/friends/reject/{request_id}")
async def reject_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    friend_req = await db.friends.find_one({"_id": ObjectId(request_id)})
    if not friend_req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    if friend_req["receiverId"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.friends.delete_one({"_id": ObjectId(request_id)})
    
    return {"message": "Friend request rejected"}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a friend (delete accepted friendship)"""
    user_id = str(current_user["_id"])
    
    result = await db.friends.delete_one({
        "$or": [
            {"senderId": user_id, "receiverId": friend_id, "status": "accepted"},
            {"senderId": friend_id, "receiverId": user_id, "status": "accepted"}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    return {"message": "Friend removed"}

@api_router.get("/search/users")
async def search_users(q: str, current_user: dict = Depends(get_current_user)):
    """Search users by username or display name"""
    user_id = str(current_user["_id"])
    
    if len(q) < 2:
        return []
    
    # Case-insensitive search on username and displayName
    users = await db.users.find({
        "_id": {"$ne": current_user["_id"]},
        "$or": [
            {"username": {"$regex": q, "$options": "i"}},
            {"displayName": {"$regex": q, "$options": "i"}}
        ]
    }).limit(20).to_list(20)
    
    # Get friend status for each
    results = []
    for user in users:
        target_id = str(user["_id"])
        
        # Check friendship status
        friendship = await db.friends.find_one({
            "$or": [
                {"senderId": user_id, "receiverId": target_id},
                {"senderId": target_id, "receiverId": user_id}
            ]
        })
        
        if friendship:
            if friendship["status"] == "accepted":
                friend_status = "friends"
            elif friendship["senderId"] == user_id:
                friend_status = "sent"
            else:
                friend_status = "received"
        else:
            friend_status = "none"
        
        results.append({
            "id": target_id,
            "username": user["username"],
            "displayName": user["displayName"],
            "photoUrl": user.get("photoUrl"),
            "level": user.get("level", 0),
            "onlineStatus": user.get("onlineStatus", False),
            "friendStatus": friend_status
        })
    
    return results

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user), limit: int = 50):
    """Get user notifications"""
    user_id = str(current_user["_id"])
    
    notifications = await db.notifications.find(
        {"userId": user_id}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return [
        {
            "id": str(notif["_id"]),
            "title": notif["title"],
            "body": notif["body"],
            "type": notif.get("type", "general"),
            "readStatus": notif.get("readStatus", False),
            "createdAt": notif["createdAt"]
        } for notif in notifications
    ]

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    user_id = str(current_user["_id"])
    count = await db.notifications.count_documents({
        "userId": user_id,
        "readStatus": False
    })
    return {"count": count}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a single notification as read"""
    user_id = str(current_user["_id"])
    
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": user_id},
        {"$set": {"readStatus": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    user_id = str(current_user["_id"])
    
    await db.notifications.update_many(
        {"userId": user_id, "readStatus": False},
        {"$set": {"readStatus": True}}
    )
    
    return {"message": "All notifications marked as read"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a notification"""
    user_id = str(current_user["_id"])
    
    result = await db.notifications.delete_one({
        "_id": ObjectId(notification_id),
        "userId": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}

# ==================== GAMES ====================

@api_router.post("/games/spin-wheel")
async def spin_wheel(current_user: dict = Depends(get_current_user)):
    """Spin the wheel game - costs 10 coins, random reward"""
    user_id = str(current_user["_id"])
    
    # Check if user has enough coins
    if current_user.get("coins", 0) < 10:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    # Deduct cost
    await add_coins(user_id, -10, "game", "Spin wheel game cost")
    
    # Random reward (0-100 coins)
    reward = random.choice([0, 5, 10, 20, 50, 100])
    
    if reward > 0:
        await add_coins(user_id, reward, "game_win", f"Spin wheel reward: {reward} coins")
    
    # Notify on big wins
    if reward >= 50:
        await db.notifications.insert_one({
            "userId": user_id,
            "title": "🎉 Big Win!",
            "body": f"You won {reward} coins on Spin the Wheel!",
            "type": "game",
            "createdAt": datetime.utcnow(),
            "readStatus": False
        })
    
    return {"reward": reward, "message": f"You won {reward} coins!"}

@api_router.post("/games/card-game/draw")
async def draw_card_game(current_user: dict = Depends(get_current_user)):
    """Draw a card (1-13), higher wins against house"""
    user_id = str(current_user["_id"])
    
    # Check if user has enough coins
    if current_user.get("coins", 0) < 10:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    # Deduct cost
    await add_coins(user_id, -10, "game", "Card game cost")
    
    # Draw cards
    player_card = random.randint(1, 13)
    house_card = random.randint(1, 13)
    
    result = "draw"
    reward = 0
    
    if player_card > house_card:
        result = "win"
        reward = 25
        await add_coins(user_id, reward, "game_win", "Card game win")
    elif player_card < house_card:
        result = "lose"
    else:
        result = "draw"
        reward = 10  # Get money back
        await add_coins(user_id, reward, "game_win", "Card game draw")
    
    return {
        "playerCard": player_card,
        "houseCard": house_card,
        "result": result,
        "reward": reward
    }

# ==================== MULTIPLAYER ROOM GAMES ====================

GAME_TIMER_SECONDS = 20
# Pretty stock images from Unsplash for game logos / banners
GAME_TYPES = {
    "card_higher": {
        "name": "Higher Card",
        "minPlayers": 2,
        "maxPlayers": 6,
        "entryFee": 10,
        "image": "https://images.unsplash.com/photo-1541278107931-e006523892df?w=800&q=70",
        "icon": "card",
        "tagline": "Draw the highest card — winner & runner-up take the pot",
    },
    "dice_roll": {
        "name": "Dice Roll",
        "minPlayers": 2,
        "maxPlayers": 6,
        "entryFee": 10,
        "image": "https://images.unsplash.com/photo-1606167668584-78701c57f13d?w=800&q=70",
        "icon": "dice",
        "tagline": "Roll two dice — highest sum wins, runner-up gets share",
    },
}

class HostGameRequest(BaseModel):
    gameType: str
    entryFee: Optional[int] = None  # Custom entry fee; min 1, defaults to game type's default
    maxPlayers: Optional[int] = None  # Custom max; min 2

def _serialize_game(game: dict) -> dict:
    """Convert game session document to API response"""
    expires_at = game.get("expiresAt")
    seconds_remaining = 0
    if expires_at and game["status"] == "waiting":
        delta = (expires_at - datetime.utcnow()).total_seconds()
        seconds_remaining = max(0, int(delta))
    
    gt_cfg = GAME_TYPES.get(game["gameType"], {})
    return {
        "id": str(game["_id"]),
        "roomId": game["roomId"],
        "gameType": game["gameType"],
        "gameTypeName": gt_cfg.get("name", game["gameType"]),
        "image": gt_cfg.get("image"),
        "icon": gt_cfg.get("icon", "game-controller"),
        "tagline": gt_cfg.get("tagline", ""),
        "hostId": game["hostId"],
        "hostName": game["hostName"],
        "players": game["players"],
        "status": game["status"],
        "minPlayers": game["minPlayers"],
        "maxPlayers": game["maxPlayers"],
        "entryFee": game["entryFee"],
        "pot": game["pot"],
        "winnerId": game.get("winnerId"),
        "winnerName": game.get("winnerName"),
        "runnerUpId": game.get("runnerUpId"),
        "runnerUpName": game.get("runnerUpName"),
        "winnerShare": game.get("winnerShare"),
        "runnerShare": game.get("runnerShare"),
        "secondsRemaining": seconds_remaining,
        "createdAt": game["createdAt"],
        "completedAt": game.get("completedAt"),
    }

async def _resolve_game(game: dict) -> dict:
    """Resolve a game when timer expires: pick winner or abort if not enough players"""
    game_id = game["_id"]
    
    if len(game["players"]) < game["minPlayers"]:
        # Abort - refund all players their entry fee
        for player in game["players"]:
            await add_coins(player["userId"], game["entryFee"], "game", "Game aborted - refund")
        
        await db.game_sessions.update_one(
            {"_id": game_id},
            {"$set": {"status": "aborted", "completedAt": datetime.utcnow()}}
        )
        
        # Post system message to chat
        await db.messages.insert_one({
            "roomId": game["roomId"],
            "senderId": "system",
            "senderName": "🎮 System",
            "senderPhoto": None,
            "messageText": f"{GAME_TYPES[game['gameType']]['name']} game aborted — not enough players. Entry fees refunded.",
            "createdAt": datetime.utcnow(),
            "reactions": [],
            "isSystem": True
        })
        
        return await db.game_sessions.find_one({"_id": game_id})
    
    # Play game - assign random values
    game_type = game["gameType"]
    players_with_results = []
    
    for player in game["players"]:
        if game_type == "card_higher":
            result_value = random.randint(1, 13)
        elif game_type == "dice_roll":
            result_value = random.randint(1, 6) + random.randint(1, 6)
        else:
            result_value = random.randint(1, 100)
        
        players_with_results.append({
            **player,
            "result": result_value
        })
    
    # Sort by result desc — tie-breaker: original join order (stable sort)
    ranked = sorted(players_with_results, key=lambda p: -p["result"])
    winner = ranked[0]
    runner_up = ranked[1] if len(ranked) > 1 else None
    
    # Reward split: pot is divided equally between winner and runner-up.
    # If pot is odd, winner gets the extra coin.
    pot = game["pot"]
    if runner_up:
        runner_share = pot // 2
        winner_share = pot - runner_share
    else:
        winner_share = pot
        runner_share = 0
    
    # Mark placements on each player
    for idx, p in enumerate(ranked):
        if idx == 0:
            p["placement"] = 1
            p["coinsWon"] = winner_share
            p["pointsEarned"] = 10
        elif idx == 1:
            p["placement"] = 2
            p["coinsWon"] = runner_share
            p["pointsEarned"] = 5
        else:
            p["placement"] = idx + 1
            p["coinsWon"] = 0
            p["pointsEarned"] = 0
    
    # Award winner
    await add_coins(winner["userId"], winner_share, "game_win", f"Won {GAME_TYPES[game_type]['name']} game")
    await db.users.update_one(
        {"_id": ObjectId(winner["userId"])},
        {"$inc": {"pointsEarned": 10, "gameWins": 1}}
    )
    
    # Award runner-up
    if runner_up:
        await add_coins(runner_up["userId"], runner_share, "game_runnerup", f"Runner-up in {GAME_TYPES[game_type]['name']}")
        await db.users.update_one(
            {"_id": ObjectId(runner_up["userId"])},
            {"$inc": {"pointsEarned": 5, "gameRunnerUps": 1}}
        )
    
    # Notify winner
    await db.notifications.insert_one({
        "userId": winner["userId"],
        "title": "🏆 You Won!",
        "body": f"+{winner_share} coins · +10 points in {GAME_TYPES[game_type]['name']}",
        "type": "game",
        "createdAt": datetime.utcnow(),
        "readStatus": False
    })
    # Notify runner-up
    if runner_up:
        await db.notifications.insert_one({
            "userId": runner_up["userId"],
            "title": "🥈 Runner-up!",
            "body": f"+{runner_share} coins · +5 points in {GAME_TYPES[game_type]['name']}",
            "type": "game",
            "createdAt": datetime.utcnow(),
            "readStatus": False
        })
    
    # Update game session
    await db.game_sessions.update_one(
        {"_id": game_id},
        {"$set": {
            "status": "completed",
            "players": ranked,
            "winnerId": winner["userId"],
            "winnerName": winner["displayName"],
            "runnerUpId": runner_up["userId"] if runner_up else None,
            "runnerUpName": runner_up["displayName"] if runner_up else None,
            "winnerShare": winner_share,
            "runnerShare": runner_share,
            "completedAt": datetime.utcnow()
        }}
    )
    
    # Post system message to chat
    rs_text = f" · 🥈 {runner_up['displayName']} +{runner_share}" if runner_up else ""
    await db.messages.insert_one({
        "roomId": game["roomId"],
        "senderId": "system",
        "senderName": "🎮 System",
        "senderPhoto": None,
        "messageText": f"🏆 {winner['displayName']} won +{winner_share} coins in {GAME_TYPES[game_type]['name']}{rs_text}",
        "createdAt": datetime.utcnow(),
        "reactions": [],
        "isSystem": True
    })
    
    return await db.game_sessions.find_one({"_id": game_id})

async def _check_and_resolve_if_expired(game: dict) -> dict:
    """Check if game waiting timer has expired and resolve it"""
    if game["status"] == "waiting" and datetime.utcnow() >= game["expiresAt"]:
        return await _resolve_game(game)
    return game

@api_router.post("/rooms/{room_id}/games")
async def host_room_game(room_id: str, req: HostGameRequest, current_user: dict = Depends(get_current_user)):
    """Host a new multiplayer game in a room"""
    user_id = str(current_user["_id"])
    
    # Verify game type
    if req.gameType not in GAME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid game type")
    
    game_config = GAME_TYPES[req.gameType]
    # Resolve custom entry fee + max players (with sane bounds)
    entry_fee = req.entryFee if req.entryFee is not None else game_config["entryFee"]
    if entry_fee < 1:
        raise HTTPException(status_code=400, detail="Entry fee must be at least 1 coin")
    if entry_fee > 100000:
        raise HTTPException(status_code=400, detail="Entry fee too high (max 100000)")
    max_players = req.maxPlayers if req.maxPlayers is not None else game_config["maxPlayers"]
    if max_players < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")
    if max_players > 32:
        raise HTTPException(status_code=400, detail="Max players is 32")

    # Verify user is in this room
    if current_user.get("currentRoomId") != room_id:
        raise HTTPException(status_code=403, detail="You must be in the room to host a game")
    
    # Check user has entry fee
    if current_user.get("coins", 0) < entry_fee:
        raise HTTPException(status_code=400, detail=f"Need at least {entry_fee} coins to host")
    
    # Check if user already has an active game in this room
    existing = await db.game_sessions.find_one({
        "roomId": room_id,
        "hostId": user_id,
        "status": "waiting"
    })
    if existing:
        existing = await _check_and_resolve_if_expired(existing)
        if existing["status"] == "waiting":
            raise HTTPException(status_code=400, detail="You already have an active game in this room")
    
    # Deduct entry fee from host
    await add_coins(user_id, -entry_fee, "game", f"Hosted {game_config['name']} entry fee")
    
    # Create game session
    expires_at = datetime.utcnow() + timedelta(seconds=GAME_TIMER_SECONDS)
    session = {
        "roomId": room_id,
        "gameType": req.gameType,
        "hostId": user_id,
        "hostName": current_user["displayName"],
        "players": [{
            "userId": user_id,
            "username": current_user["username"],
            "displayName": current_user["displayName"],
            "photoUrl": current_user.get("photoUrl"),
        }],
        "status": "waiting",
        "minPlayers": game_config["minPlayers"],
        "maxPlayers": max_players,
        "entryFee": entry_fee,
        "pot": entry_fee,
        "expiresAt": expires_at,
        "createdAt": datetime.utcnow(),
        "gameState": {}
    }
    
    result = await db.game_sessions.insert_one(session)
    session["_id"] = result.inserted_id
    
    # Post system message to chat announcing the game
    await db.messages.insert_one({
        "roomId": room_id,
        "senderId": "system",
        "senderName": "🎮 System",
        "senderPhoto": None,
        "messageText": f"{current_user['displayName']} hosted a {game_config['name']} game! Join within 20s · {entry_fee} coins entry",
        "createdAt": datetime.utcnow(),
        "reactions": [],
        "isSystem": True
    })
    
    return _serialize_game(session)

@api_router.post("/games/{game_id}/join")
async def join_room_game(game_id: str, current_user: dict = Depends(get_current_user)):
    """Join a multiplayer game"""
    user_id = str(current_user["_id"])
    
    game = await db.game_sessions.find_one({"_id": ObjectId(game_id)})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check timer (auto-resolve if expired)
    game = await _check_and_resolve_if_expired(game)
    
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game is not accepting players")
    
    # Verify user is in the game's room
    if current_user.get("currentRoomId") != game["roomId"]:
        raise HTTPException(status_code=403, detail="You must be in the same room to join")
    
    # Check not already joined
    if any(p["userId"] == user_id for p in game["players"]):
        raise HTTPException(status_code=400, detail="You already joined this game")
    
    # Check capacity
    if len(game["players"]) >= game["maxPlayers"]:
        raise HTTPException(status_code=400, detail="Game is full")
    
    # Check coins
    if current_user.get("coins", 0) < game["entryFee"]:
        raise HTTPException(status_code=400, detail=f"Need {game['entryFee']} coins to join")
    
    # Deduct entry fee
    await add_coins(user_id, -game["entryFee"], "game", f"Joined {game['gameType']} game")
    
    # Add player to game
    player_data = {
        "userId": user_id,
        "username": current_user["username"],
        "displayName": current_user["displayName"],
        "photoUrl": current_user.get("photoUrl"),
    }
    
    await db.game_sessions.update_one(
        {"_id": ObjectId(game_id)},
        {"$push": {"players": player_data}, "$inc": {"pot": game["entryFee"]}}
    )
    
    updated_game = await db.game_sessions.find_one({"_id": ObjectId(game_id)})
    return _serialize_game(updated_game)

@api_router.get("/rooms/{room_id}/games")
async def get_room_games(room_id: str, current_user: dict = Depends(get_current_user)):
    """Get active and recently completed games in a room"""
    # Recent cutoff: include games completed within last 30 seconds (for results display)
    cutoff = datetime.utcnow() - timedelta(seconds=30)
    
    games = await db.game_sessions.find({
        "roomId": room_id,
        "$or": [
            {"status": "waiting"},
            {"completedAt": {"$gte": cutoff}}
        ]
    }).sort("createdAt", -1).to_list(20)
    
    # Auto-resolve expired waiting games
    resolved_games = []
    for game in games:
        game = await _check_and_resolve_if_expired(game)
        resolved_games.append(game)
    
    return [_serialize_game(g) for g in resolved_games]

@api_router.get("/games/{game_id}")
async def get_game_state(game_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed state of a specific game"""
    game = await db.game_sessions.find_one({"_id": ObjectId(game_id)})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Auto-resolve if expired
    game = await _check_and_resolve_if_expired(game)
    
    return _serialize_game(game)

@api_router.get("/games/types/list")
async def list_game_types():
    """List available multiplayer game types"""
    return [
        {"id": key, **value}
        for key, value in GAME_TYPES.items()
    ]

# ==================== COIN GIFTING (USER → USER) ====================

DAILY_COIN_GIFT_LIMIT = 1000
MIN_COIN_GIFT = 10

class SendCoinsPayload(BaseModel):
    receiverId: str
    amount: int
    message: Optional[str] = ""

@api_router.get("/coins/send-status")
async def coin_send_status(current_user: dict = Depends(get_current_user)):
    """How many coins the current user has already gifted today (rolling 24h)."""
    me_id = str(current_user["_id"])
    since = datetime.utcnow() - timedelta(hours=24)
    pipeline = [
        {"$match": {"senderId": me_id, "createdAt": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    agg = await db.coin_gifts.aggregate(pipeline).to_list(1)
    sent_today = agg[0]["total"] if agg else 0
    return {
        "sentToday": sent_today,
        "dailyLimit": DAILY_COIN_GIFT_LIMIT,
        "remainingToday": max(0, DAILY_COIN_GIFT_LIMIT - sent_today),
        "minPerSend": MIN_COIN_GIFT,
    }

@api_router.post("/coins/send")
async def send_coins(payload: SendCoinsPayload, current_user: dict = Depends(get_current_user)):
    """Send coins to another user. Min 10, daily cap 1000 outgoing per sender."""
    me_id = str(current_user["_id"])
    if me_id == payload.receiverId:
        raise HTTPException(status_code=400, detail="You can't send coins to yourself")
    if payload.amount < MIN_COIN_GIFT:
        raise HTTPException(status_code=400, detail=f"Minimum send is {MIN_COIN_GIFT} coins")
    if current_user.get("coins", 0) < payload.amount:
        raise HTTPException(status_code=400, detail="Not enough coins in your wallet")

    if not ObjectId.is_valid(payload.receiverId):
        raise HTTPException(status_code=400, detail="Invalid recipient")
    receiver = await db.users.find_one({"_id": ObjectId(payload.receiverId)})
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # Rolling 24h gift cap
    since = datetime.utcnow() - timedelta(hours=24)
    pipeline = [
        {"$match": {"senderId": me_id, "createdAt": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    agg = await db.coin_gifts.aggregate(pipeline).to_list(1)
    sent_today = agg[0]["total"] if agg else 0
    if sent_today + payload.amount > DAILY_COIN_GIFT_LIMIT:
        remaining = max(0, DAILY_COIN_GIFT_LIMIT - sent_today)
        raise HTTPException(
            status_code=400,
            detail=f"Daily gift limit reached. You can send {remaining} more coins today.",
        )

    # Transfer
    await add_coins(me_id, -payload.amount, "coins_sent", f"Sent {payload.amount} coins to {receiver['displayName']}")
    await add_coins(payload.receiverId, payload.amount, "coins_received", f"Received {payload.amount} coins from {current_user['displayName']}")

    # Log the gift
    await db.coin_gifts.insert_one({
        "senderId": me_id,
        "receiverId": payload.receiverId,
        "amount": payload.amount,
        "message": (payload.message or "")[:200],
        "createdAt": datetime.utcnow(),
    })

    # Notify recipient
    await db.notifications.insert_one({
        "userId": payload.receiverId,
        "title": f"🪙 +{payload.amount} coins",
        "body": f"{current_user['displayName']} sent you {payload.amount} coins" + (f": {payload.message}" if payload.message else ""),
        "type": "coins_received",
        "relatedUserId": me_id,
        "createdAt": datetime.utcnow(),
        "readStatus": False,
    })

    # Feed activities
    await _create_activity(
        user_id=payload.receiverId,
        actor_id=me_id,
        activity_type="coins_received",
        message=f"received {payload.amount} coins from {current_user['displayName']}",
        metadata={"amount": payload.amount, "senderName": current_user["displayName"]},
        audience="friends",
    )

    return {
        "message": f"Sent {payload.amount} coins to {receiver['displayName']}",
        "amount": payload.amount,
        "sentToday": sent_today + payload.amount,
        "remainingToday": max(0, DAILY_COIN_GIFT_LIMIT - sent_today - payload.amount),
    }


# ==================== BOARD POSTS ====================

def _serialize_post(post: dict, current_user_id: str) -> dict:
    """Serialize a board post for API response"""
    likes = post.get("likes", [])
    return {
        "id": str(post["_id"]),
        "roomId": post["roomId"],
        "authorId": post["authorId"],
        "authorUsername": post.get("authorUsername", ""),
        "authorDisplayName": post.get("authorDisplayName", ""),
        "authorPhotoUrl": post.get("authorPhotoUrl"),
        "authorVipTier": post.get("authorVipTier"),
        "text": post["text"],
        "imageBase64": post.get("imageBase64"),
        "likesCount": len(likes),
        "commentsCount": post.get("commentsCount", 0),
        "likedByMe": current_user_id in likes,
        "createdAt": post["createdAt"].isoformat() if isinstance(post["createdAt"], datetime) else post["createdAt"]
    }

def _serialize_comment(comment: dict) -> dict:
    """Serialize a board comment for API response"""
    return {
        "id": str(comment["_id"]),
        "postId": comment["postId"],
        "authorId": comment["authorId"],
        "authorUsername": comment.get("authorUsername", ""),
        "authorDisplayName": comment.get("authorDisplayName", ""),
        "authorPhotoUrl": comment.get("authorPhotoUrl"),
        "authorVipTier": comment.get("authorVipTier"),
        "text": comment["text"],
        "createdAt": comment["createdAt"].isoformat() if isinstance(comment["createdAt"], datetime) else comment["createdAt"]
    }

@api_router.get("/users/{user_id}/posts")
async def get_user_posts(
    user_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all posts authored by a specific user across rooms (Profile → Posts tab)."""
    me_id = str(current_user["_id"])
    posts = await db.board_posts.find({"authorId": user_id}).sort("createdAt", -1).limit(limit).to_list(limit)
    return [_serialize_post(post, me_id) for post in posts]


@api_router.get("/rooms/{room_id}/posts")
async def get_room_posts(
    room_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all posts for a specific room (Board feature)"""
    user_id = str(current_user["_id"])
    
    # Verify room exists
    room = await db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Build query
    query = {"roomId": room_id}
    if before:
        try:
            before_post = await db.board_posts.find_one({"_id": ObjectId(before)})
            if before_post:
                query["createdAt"] = {"$lt": before_post["createdAt"]}
        except Exception:
            pass
    
    # Fetch posts sorted by newest first
    posts = await db.board_posts.find(query).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return [_serialize_post(post, user_id) for post in posts]

@api_router.post("/rooms/{room_id}/posts")
async def create_room_post(
    room_id: str,
    post_data: BoardPostCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new post in a room's Board"""
    user_id = str(current_user["_id"])
    
    # Verify room exists
    room = await db.rooms.find_one({"_id": ObjectId(room_id)})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Validate text content
    if not post_data.text or not post_data.text.strip():
        raise HTTPException(status_code=400, detail="Post text is required")
    
    if len(post_data.text) > 2000:
        raise HTTPException(status_code=400, detail="Post text cannot exceed 2000 characters")
    
    # Validate image size if provided (max 5MB base64)
    if post_data.imageBase64 and len(post_data.imageBase64) > 7_000_000:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    
    # Create post
    post = {
        "roomId": room_id,
        "authorId": user_id,
        "authorUsername": current_user.get("username", ""),
        "authorDisplayName": current_user.get("displayName", ""),
        "authorPhotoUrl": current_user.get("photoUrl"),
        "authorVipTier": current_user.get("vipTier"),
        "text": post_data.text.strip(),
        "imageBase64": post_data.imageBase64,
        "likes": [],
        "commentsCount": 0,
        "createdAt": datetime.utcnow()
    }
    
    result = await db.board_posts.insert_one(post)
    post["_id"] = result.inserted_id
    
    # Log activity to room feed
    await create_room_activity(
        room_id=room_id,
        activity_type="post_created",
        actor_id=user_id,
        target_id=str(result.inserted_id),
        metadata={"postText": post_data.text.strip()[:100]}  # First 100 chars as preview
    )

    # Notify the author's accepted friends ("user created a new post")
    friend_links = await db.friends.find({
        "status": "accepted",
        "$or": [{"senderId": user_id}, {"receiverId": user_id}],
    }).to_list(500)
    friend_ids = {
        (f["receiverId"] if f["senderId"] == user_id else f["senderId"])
        for f in friend_links
    }
    if friend_ids:
        preview = post_data.text.strip()[:80] or ("Shared a photo" if post_data.imageBase64 else "New post")
        now = datetime.utcnow()
        notifications = [
            {
                "userId": fid,
                "title": f"{current_user['displayName']} posted",
                "body": preview,
                "type": "friend_post",
                "relatedUserId": user_id,
                "relatedPostId": str(result.inserted_id),
                "relatedRoomId": room_id,
                "createdAt": now,
                "readStatus": False,
            }
            for fid in friend_ids
        ]
        if notifications:
            await db.notifications.insert_many(notifications)

    return _serialize_post(post, user_id)

@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single post by ID"""
    user_id = str(current_user["_id"])
    
    post = await db.board_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return _serialize_post(post, user_id)

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a post (only by author)"""
    user_id = str(current_user["_id"])
    
    post = await db.board_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["authorId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    # Delete all comments for this post
    await db.board_comments.delete_many({"postId": post_id})
    
    # Delete the post
    await db.board_posts.delete_one({"_id": ObjectId(post_id)})
    
    return {"message": "Post deleted successfully"}

@api_router.post("/posts/{post_id}/like")
async def toggle_like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle like on a post"""
    user_id = str(current_user["_id"])
    
    post = await db.board_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    if user_id in likes:
        # Unlike
        await db.board_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$pull": {"likes": user_id}}
        )
        liked = False
    else:
        # Like
        await db.board_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$addToSet": {"likes": user_id}}
        )
        liked = True
        
        # Log like activity to room feed (only for likes, not unlikes)
        await create_room_activity(
            room_id=post["roomId"],
            activity_type="post_liked",
            actor_id=user_id,
            target_id=post_id,
            target_name=post.get("authorUsername"),
            metadata={"postText": post.get("text", "")[:50]}
        )
    
    # Get updated post
    updated_post = await db.board_posts.find_one({"_id": ObjectId(post_id)})
    
    return {
        "liked": liked,
        "likesCount": len(updated_post.get("likes", []))
    }

@api_router.get("/posts/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all comments for a post"""
    post = await db.board_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = await db.board_comments.find({"postId": post_id}).sort("createdAt", 1).limit(limit).to_list(limit)
    
    return [_serialize_comment(comment) for comment in comments]

@api_router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    comment_data: BoardCommentCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a comment to a post"""
    user_id = str(current_user["_id"])
    
    post = await db.board_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if not comment_data.text or not comment_data.text.strip():
        raise HTTPException(status_code=400, detail="Comment text is required")
    
    if len(comment_data.text) > 500:
        raise HTTPException(status_code=400, detail="Comment cannot exceed 500 characters")
    
    comment = {
        "postId": post_id,
        "authorId": user_id,
        "authorUsername": current_user.get("username", ""),
        "authorDisplayName": current_user.get("displayName", ""),
        "authorPhotoUrl": current_user.get("photoUrl"),
        "authorVipTier": current_user.get("vipTier"),
        "text": comment_data.text.strip(),
        "createdAt": datetime.utcnow()
    }
    
    result = await db.board_comments.insert_one(comment)
    comment["_id"] = result.inserted_id
    
    # Increment comment count on post
    await db.board_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"commentsCount": 1}}
    )
    
    return _serialize_comment(comment)

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a comment (only by author)"""
    user_id = str(current_user["_id"])
    
    comment = await db.board_comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["authorId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    # Delete the comment
    await db.board_comments.delete_one({"_id": ObjectId(comment_id)})
    
    # Decrement comment count on post
    await db.board_posts.update_one(
        {"_id": ObjectId(comment["postId"])},
        {"$inc": {"commentsCount": -1}}
    )
    
    return {"message": "Comment deleted successfully"}

# ==================== INITIALIZATION ====================

@api_router.post("/init/rooms")
async def initialize_rooms():
    """Initialize / upsert default rooms with banner images."""
    # Banner = card / outside thumbnail. Background = soft light interior image.
    default_rooms = [
        {
            "roomName": "World Vibez",
            "roomCategory": "World Vibez",
            "roomDescription": "Connect with people from around the world",
            "roomBanner": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=900&q=60",
        },
        {
            "roomName": "Games Hub",
            "roomCategory": "Games",
            "roomDescription": "Discuss your favorite games",
            "roomBanner": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1606639386377-e89bcf2dbb44?w=900&q=60",
        },
        {
            "roomName": "BTS Army",
            "roomCategory": "BTS",
            "roomDescription": "For BTS fans worldwide",
            "roomBanner": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1499415479124-43c32433a620?w=900&q=60",
        },
        {
            "roomName": "Harry Potter Fans",
            "roomCategory": "Harry Potter",
            "roomDescription": "Welcome to Hogwarts",
            "roomBanner": "https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?w=900&q=60",
        },
        {
            "roomName": "India",
            "roomCategory": "Country",
            "roomDescription": "Namaste! Chat with people from India",
            "roomBanner": "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&q=60",
        },
        {
            "roomName": "Philippines",
            "roomCategory": "Country",
            "roomDescription": "Mabuhay! Vibe with friends from the PH",
            "roomBanner": "/api/static/rooms/philippines.png",
            "roomBackground": "https://images.unsplash.com/photo-1519181258491-c302bc59b46a?w=900&q=60",
        },
        {
            "roomName": "Hindi",
            "roomCategory": "Language",
            "roomDescription": "Hindi mein baatchit karne wali jagah",
            "roomBanner": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1582719188393-bb71ca45dbb9?w=900&q=60",
        },
        {
            "roomName": "Party",
            "roomCategory": "Vibe",
            "roomDescription": "Let the party never stop",
            "roomBanner": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=70",
            "roomBackground": "https://images.unsplash.com/photo-1496843916299-590492c751f4?w=900&q=60",
        },
        {
            "roomName": "Birthday",
            "roomCategory": "Vibe",
            "roomDescription": "Celebrate birthdays together",
            "roomBanner": "/api/static/rooms/birthday.png",
            "roomBackground": "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=900&q=60",
        },
    ]

    now = datetime.utcnow()
    for r in default_rooms:
        await db.rooms.update_one(
            {"roomName": r["roomName"]},
            {
                "$set": {
                    "roomCategory": r["roomCategory"],
                    "roomDescription": r["roomDescription"],
                    "roomBanner": r["roomBanner"],
                    "roomBackground": r["roomBackground"],
                    "maxCapacity": 36,
                },
                "$setOnInsert": {
                    "roomName": r["roomName"],
                    "currentUserCount": 0,
                    "createdBy": "system",
                    "createdAt": now,
                },
            },
            upsert=True,
        )
    return {"message": "Default rooms initialized", "count": len(default_rooms)}

# ─────────────────────────────────────────────────────────────────────────────
# P1 modular routers (extracted Jun 2026). Imported here AFTER all shared
# state (`api_router`, `db`, helpers like `add_coins`, `GAME_TYPES`) is
# defined. Each submodule decorates `api_router` with its own routes on
# import — keeping `server.py` focused on shared state & cross-cutting setup.
# ─────────────────────────────────────────────────────────────────────────────
from routes import tournaments as _tournaments_router  # noqa: E402, F401
from routes import leaderboard as _leaderboard_router  # noqa: E402, F401
from routes import vip as _vip_router  # noqa: E402, F401

# Include router
app.include_router(api_router)

# Static files (room thumbnails, etc.). Mounted under /api/static so the
# Kubernetes ingress (which only routes /api/* to the backend) forwards
# requests correctly.
from fastapi.staticfiles import StaticFiles  # noqa: E402
app.mount("/api/static", StaticFiles(directory=str(ROOT_DIR / "static")), name="static")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def _ensure_indexes():
    """Create necessary unique indexes (idempotent)."""
    try:
        await db.profile_likes.create_index(
            [("targetUserId", 1), ("likerId", 1)], unique=True, name="uniq_target_liker"
        )
    except Exception as e:
        print(f"[startup] profile_likes index warn: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
