# GenC Vibez - Product Requirements Document

## App Overview
**GenC Vibez** is a dark-themed, room-based social community mobile application built with Expo (React Native), FastAPI, and MongoDB.

## Tech Stack
- **Frontend**: Expo SDK 54 + React Native + TypeScript + Expo Router
- **Backend**: FastAPI + Motor (Async MongoDB driver) + JWT auth
- **Database**: MongoDB
- **Auth**: Email/Password with JWT tokens (bcrypt password hashing)

## Features Implemented

### Authentication
- Email/password registration with auto-login
- JWT-based session management
- Persistent login (stored in AsyncStorage)
- Secure logout (platform-aware confirmation)

### Room System (Core Feature)
- 4 Default rooms: **World Vibez, Games Hub, BTS Army, Harry Potter Fans**
- Max 36 users per room (enforced server-side)
- Real-time occupancy display (X/36)
- Auto-refresh every 3 seconds for live updates
- 36-slot member grid showing room participants
- User can only be in 1 room at a time
- Auto-leave previous room when joining new one

### Chat System
- Room-based real-time messaging
- Security: Users can only send messages while in the room
- 50 most recent messages displayed
- Auto-scroll to latest message
- Sender info display (name, avatar)

### Coins & XP System
**Coins:**
- 100 coins on registration (welcome bonus)
- 50 coins daily login (every 24 hours)
- 10 coins per room join
- 5 coins per 10 messages sent (active participation)
- Game costs/rewards

**XP & Levels:**
- 1 XP per message sent
- Level = XP / 100 (auto-calculated)
- Displayed in header and profile

### Mini Games
1. **Spin the Wheel** - Cost: 10 coins, Win: 0-100 coins (random)
2. **Card Game** - Cost: 10 coins, Higher card wins 25 coins, draw refunds 10

### Leaderboards
- **XP Leaderboard** - Top users by XP/Level
- **Coins Leaderboard** - Top users by coin balance
- **Active Leaderboard** - Most active users by message count

### Profile Management
- View profile (username, display name, email, bio)
- Edit profile (display name, bio)
- Photo upload via Image Picker (camera roll)
- Stats display (Coins, XP, Level)

## API Endpoints (18 endpoints)
- Auth: register, login, me
- Users: profile (get/update), get by ID, avatars/predefined
- Rooms: list, join, leave, members, init
- Messages: get, send
- Games: spin-wheel, card-game/draw
- Coins: transactions, daily-reward
- Friends: request, accept, list
- Leaderboards: xp, coins, active

## Database Schema (MongoDB)
- `users` - User accounts with coins, xp, level
- `rooms` - Public rooms with capacity tracking
- `room_members` - Active room participants
- `messages` - Room chat messages
- `friends` - Friend relationships
- `notifications` - User notifications
- `coin_transactions` - Coin transaction history
- `game_sessions` - Game state (ready for multiplayer)

## Security Features
- JWT-based authentication
- Bcrypt password hashing
- Users can only edit their own profile
- Users cannot modify others' coins
- Room capacity strictly enforced
- Message sending restricted to room members
- All API routes protected by auth middleware

## Scalability Considerations
- MongoDB for horizontal scaling
- Async/await throughout backend
- Efficient room occupancy via cached counter
- Optimized queries with proper indexing
- Stateless backend (JWT) for easy scaling
- WebSocket endpoint available for real-time upgrades

## Test Results
- Backend: 18/18 tests passing (100%)
- Frontend: All core flows verified working
- E2E flow confirmed: Register → Join Room → Chat → Play Games → Leaderboard

## Default Test Accounts
See `/app/memory/test_credentials.md`

## Future Enhancements (Not in MVP)
- Ludo multiplayer game
- Snake & Ladder game
- Voice chat in rooms
- Custom room creation by users
- Push notifications
- Profile achievements/badges
- Friend invitations & private messaging
