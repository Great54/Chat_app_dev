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
                except:
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
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

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

class UpdateProfile(BaseModel):
    displayName: Optional[str] = None
    photoUrl: Optional[str] = None
    bannerUrl: Optional[str] = None
    bio: Optional[str] = None

class VipPurchase(BaseModel):
    tier: str  # "pro" or "elite"

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

class PredefinedAvatar(BaseModel):
    id: str
    avatarUrl: str
    category: str

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
        createdAt=user.get("createdAt", datetime.utcnow())
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
    return user

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
    user = await db.users.find_one({"email": user_data.email})
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
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
    
    access_token = create_access_token({"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

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

@api_router.get("/avatars/predefined")
async def get_predefined_avatars():
    """Get predefined avatars - returns sample base64 placeholder"""
    # In production, these would be actual base64 images stored in DB
    avatars = [
        {"id": f"avatar_{i}", "category": "default", "avatarUrl": f"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI3t7Y29sb3J9fSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjgwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPnt7bnVtYmVyfX08L3RleHQ+PC9zdmc+"} 
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
            maxCapacity=room.get("maxCapacity", 36),
            currentUserCount=room.get("currentUserCount", 0),
            createdBy=room["createdBy"],
            createdAt=room["createdAt"]
        ) for room in rooms
    ]

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
    
    # Update user's current room
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"currentRoomId": room_id}}
    )
    
    # Add room join reward
    await add_coins(user_id, 10, "room_join", f"Joined {room['roomName']}")
    
    # Broadcast room update
    await manager.broadcast(room_id, {
        "type": "user_joined",
        "userId": user_id,
        "username": current_user["username"]
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
    
    # Update user's current room
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"currentRoomId": None}}
    )
    
    return {"message": "Left room successfully"}

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
            "onlineStatus": member.get("onlineStatus", True)
        })
    return enriched

# ==================== MESSAGE ROUTES ====================

@api_router.get("/messages/{room_id}")
async def get_messages(room_id: str, limit: int = 50):
    messages = await db.messages.find({"roomId": room_id}).sort("createdAt", -1).limit(limit).to_list(limit)
    messages.reverse()
    
    return [
        Message(
            id=str(msg["_id"]),
            roomId=msg["roomId"],
            senderId=msg["senderId"],
            senderName=msg["senderName"],
            senderPhoto=msg.get("senderPhoto"),
            messageText=msg["messageText"],
            createdAt=msg["createdAt"],
            reactions=msg.get("reactions", [])
        ) for msg in messages
    ]

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
    message_obj = Message(
        id=str(result.inserted_id),
        roomId=room_id,
        senderId=user_id,
        senderName=current_user["displayName"],
        senderPhoto=current_user.get("photoUrl"),
        messageText=message_data.messageText,
        createdAt=message_doc["createdAt"],
        reactions=[]
    )
    
    await manager.broadcast(room_id, {
        "type": "new_message",
        "message": message_obj.dict()
    })
    
    return message_obj

# ==================== WEBSOCKET ====================

@app.websocket("/ws/room/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
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
GAME_TYPES = {
    "card_higher": {"name": "Higher Card", "minPlayers": 2, "maxPlayers": 6, "entryFee": 10},
    "dice_roll": {"name": "Dice Roll", "minPlayers": 2, "maxPlayers": 6, "entryFee": 10},
}

class HostGameRequest(BaseModel):
    gameType: str

def _serialize_game(game: dict) -> dict:
    """Convert game session document to API response"""
    expires_at = game.get("expiresAt")
    seconds_remaining = 0
    if expires_at and game["status"] == "waiting":
        delta = (expires_at - datetime.utcnow()).total_seconds()
        seconds_remaining = max(0, int(delta))
    
    return {
        "id": str(game["_id"]),
        "roomId": game["roomId"],
        "gameType": game["gameType"],
        "gameTypeName": GAME_TYPES.get(game["gameType"], {}).get("name", game["gameType"]),
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
    
    # Find winner (highest result; if tie, first to join wins)
    winner = max(players_with_results, key=lambda p: p["result"])
    
    # Award pot to winner
    await add_coins(winner["userId"], game["pot"], "game_win", f"Won {GAME_TYPES[game_type]['name']} game")
    
    # Notify winner
    await db.notifications.insert_one({
        "userId": winner["userId"],
        "title": "🏆 You Won!",
        "body": f"Won {game['pot']} coins in {GAME_TYPES[game_type]['name']} game",
        "type": "game",
        "createdAt": datetime.utcnow(),
        "readStatus": False
    })
    
    # Update game session
    await db.game_sessions.update_one(
        {"_id": game_id},
        {"$set": {
            "status": "completed",
            "players": players_with_results,
            "winnerId": winner["userId"],
            "winnerName": winner["displayName"],
            "completedAt": datetime.utcnow()
        }}
    )
    
    # Post system message to chat
    await db.messages.insert_one({
        "roomId": game["roomId"],
        "senderId": "system",
        "senderName": "🎮 System",
        "senderPhoto": None,
        "messageText": f"🏆 {winner['displayName']} won {game['pot']} coins in {GAME_TYPES[game_type]['name']}!",
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
    
    # Verify user is in this room
    if current_user.get("currentRoomId") != room_id:
        raise HTTPException(status_code=403, detail="You must be in the room to host a game")
    
    # Check user has entry fee
    if current_user.get("coins", 0) < game_config["entryFee"]:
        raise HTTPException(status_code=400, detail=f"Need at least {game_config['entryFee']} coins to host")
    
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
    await add_coins(user_id, -game_config["entryFee"], "game", f"Hosted {game_config['name']} entry fee")
    
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
        "maxPlayers": game_config["maxPlayers"],
        "entryFee": game_config["entryFee"],
        "pot": game_config["entryFee"],
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
        "messageText": f"{current_user['displayName']} hosted a {game_config['name']} game! Join within 20s · {game_config['entryFee']} coins entry",
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
    
    if current_user.get("coins", 0) < effective_price:
        raise HTTPException(
            status_code=400,
            detail=f"Need {effective_price} coins (you have {current_user.get('coins', 0)})"
        )
    
    # Deduct price
    await add_coins(user_id, -effective_price, "vip_purchase", f"Purchased {tier_config['name']}")
    # Award bonus coins
    await add_coins(user_id, tier_config["bonusCoins"], "vip_bonus", f"{tier_config['name']} signup bonus")
    
    # Apply VIP tier + vouchers
    await db.users.update_one(
        {"_id": current_user["_id"]},
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
    
    updated = await db.users.find_one({"_id": current_user["_id"]})
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

# ==================== INITIALIZATION ====================

@api_router.post("/init/rooms")
async def initialize_rooms():
    """Initialize default rooms - call once"""
    default_rooms = [
        {
            "roomName": "World Vibez",
            "roomCategory": "World Vibez",
            "roomDescription": "Connect with people from around the world",
            "roomBanner": None,
            "maxCapacity": 36,
            "currentUserCount": 0,
            "createdBy": "system",
            "createdAt": datetime.utcnow()
        },
        {
            "roomName": "Games Hub",
            "roomCategory": "Games",
            "roomDescription": "Discuss your favorite games",
            "roomBanner": None,
            "maxCapacity": 36,
            "currentUserCount": 0,
            "createdBy": "system",
            "createdAt": datetime.utcnow()
        },
        {
            "roomName": "BTS Army",
            "roomCategory": "BTS",
            "roomDescription": "For BTS fans worldwide",
            "roomBanner": None,
            "maxCapacity": 36,
            "currentUserCount": 0,
            "createdBy": "system",
            "createdAt": datetime.utcnow()
        },
        {
            "roomName": "Harry Potter Fans",
            "roomCategory": "Harry Potter",
            "roomDescription": "Welcome to Hogwarts",
            "roomBanner": None,
            "maxCapacity": 36,
            "currentUserCount": 0,
            "createdBy": "system",
            "createdAt": datetime.utcnow()
        }
    ]
    
    # Check if rooms already exist
    existing_count = await db.rooms.count_documents({})
    if existing_count > 0:
        return {"message": "Rooms already initialized"}
    
    await db.rooms.insert_many(default_rooms)
    return {"message": "Default rooms created successfully"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
