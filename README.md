# GenC Vibez — Social Community Mobile App

A room-based social platform built with Expo (React Native Web), FastAPI, and MongoDB.

---

## Features

### Core
- **Email / Password Auth** with JWT (bcrypt-hashed passwords)
- **Room-Based Social System** — up to 36 users per room, scattered avatar canvas with drag-to-move
- **Real-time Chat** with 3-second polling, message + DM unread badges
- **Coins / XP / Level** progression with transaction history
- **In-Room Mini Games** — Higher Card, Dice Roll, more (host any game from the room header)
- **Knockout Tournaments** — public & 6-char-code private brackets, automatic pot payout
- **Leaderboards** — Points (game wins / runner-ups / tournaments won) and Coins Spent (refund-aware)
- **Notifications + Sound Effects** — three synthesized SFX (room-enter, notification, message) via the Web Audio API
- **Default Avatars** — 3 hand-illustrated cute-astronaut PNGs assigned randomly on signup (panda 🐼 · corgi 🐶 · alien 👽)
- **VIP Tiers** — Pro / Elite with auras, gold halo, +1.18× avatar scale, and 5 themed leaderboard skin (Gaming Arena Champions by default)

### Default Rooms (seeded via `POST /api/init/rooms`)
1. **World Vibez** — Global chat
2. **Games Hub** — Game-talk & lobbies
3. **BTS Army** — K-pop fans
4. **Harry Potter Fans** — Wizarding lounge

### Earning System
**Coins**
- 100 coins on registration
- 50 coins daily login
- 10 coins when joining a room
- 5 coins every 10 messages
- Game / tournament winnings (pot share)

**XP & Levels**
- +1 XP per message
- `level = xp // 100`

### Sound Effects
| Event | Sound | Where it triggers |
|---|---|---|
| New room member appears | airy whoosh-pop (220→660 Hz sweep + noise) | Inside any room |
| New notification arrives | bright two-note ding (E6 → A6) | App-wide, polled every 8 s |
| New chat / DM message | soft pop-tap (660→420 Hz) | App-wide, room chat + DM unread polled every 6 s |

Synthesized live via Web Audio (no asset files). Per-tag throttle, single AudioContext, one-time browser autoplay unlock on first user gesture, `setSoundsEnabled(false)` mute hook in `src/utils/sound.ts`.

---

## Tech Stack

### Frontend (Expo SDK 54, React Native Web)
- Expo Router (file-based)
- TypeScript
- expo-image, expo-image-picker, expo-haptics
- axios, AsyncStorage
- Lucide icons + Ionicons
- Web Audio API for SFX

### Backend (Python 3.11 + FastAPI)
- Motor (async MongoDB)
- python-jose (JWT)
- passlib + bcrypt
- Pydantic v2
- FastAPI StaticFiles mount for default avatars
- Modular routes under `routes/` (tournaments, leaderboard, …) — main `server.py`

### Database — MongoDB
Collections: `users`, `rooms`, `room_members`, `messages`, `direct_messages`, `friends`, `friend_requests`, `notifications`, `coin_transactions`, `game_sessions`, `tournaments`, `profile_likes`, `board_posts`.

---

## Getting Started

### Prerequisites
- Node 18+, Python 3.11+, MongoDB
- Yarn (npm will break the lockfile)

### Local Setup
```bash
# Backend
cd /app/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (web preview)
cd /app/frontend
yarn install
yarn start            # -> CI=true expo start --web --port 3000
```

Both processes are managed by **supervisor** in the container:
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend   # Metro is in CI mode → restart to pick up code changes
```

Seed default rooms (idempotent):
```bash
curl -X POST http://localhost:8001/api/init/rooms
```

### Required environment variables
**`/app/backend/.env`**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=genc_vibez
```

**`/app/frontend/.env`**
```
EXPO_TUNNEL_SUBDOMAIN="<your-app-subdomain>"
EXPO_PACKAGER_HOSTNAME="https://<your-app>.preview.emergentagent.com"
EXPO_PUBLIC_BACKEND_URL="https://<your-app>.preview.emergentagent.com"
EXPO_USE_FAST_RESOLVER="1"
EXPO_PACKAGER_PROXY_URL="https://<your-app>.ngrok.io"
```

### Test Credentials
See `/app/memory/test_credentials.md`.

---

## REST API (under `/api`)

### Auth
- `POST /auth/register` — creates user, assigns a random default avatar (panda / corgi / alien), returns JWT
- `POST /auth/login` — `{identifier, password}` (identifier = email **or** username)
- `GET  /auth/me`
- `POST /auth/forgot-password` · `POST /auth/reset-password`

### Rooms
- `GET  /rooms`
- `POST /rooms/{room_id}/join` · `POST /rooms/{room_id}/leave`
- `GET  /rooms/{room_id}/members`
- `POST /init/rooms` (seed defaults — idempotent)

### Messages
- `GET  /messages/{room_id}` · `POST /messages/{room_id}`
- DMs: `GET /messages/direct/...`, `GET /messages/direct/unread/total`

### Games (in-room)
- `POST /rooms/{room_id}/games` — host a Higher Card / Dice game
- `GET  /rooms/{room_id}/games`
- `POST /games/{game_id}/join` · `POST /games/{game_id}/play`
- Lone-host aborts after 20 s → entry fee refunded **and** the original spend row is flagged `refunded:true` (so it's excluded from the Coins-Spent leaderboard).

### Tournaments
- `POST /tournaments` — create public or private (6-char `joinCode`)
- `POST /tournaments/join/{code}` · `POST /tournaments/{tid}/join`
- `GET  /tournaments?roomId=...`
- Lone-creator cancellation refunds + flags refunded the same way games do.

### Leaderboards
- `GET /leaderboard/points` — game wins / runner-ups / tournaments won
- `GET /leaderboard/coins-spent` — sums negative coin transactions **excluding `refunded:true`**

### Coins, Profile, Friends, Notifications
- `GET  /coins/transactions`
- `PUT  /users/profile` · `GET /users/{user_id}`
- `POST /friends/request` · `POST /friends/accept` · `GET /friends`
- `GET  /notifications` · `DELETE /notifications/{id}`

### Static Assets
- `/api/static/avatars/default-{1,2,3}-{panda,corgi,alien}.png` — bundled default profile images
- `/api/static/rooms/<slug>.png` — room banners

---

## Frontend Structure

```
app/
├── (auth)/              # login.tsx, register.tsx, forgot-password.tsx
├── (tabs)/
│   ├── index.tsx        # Rooms list
│   ├── leaderboard.tsx  # "Gaming Arena Champions" themed neon arena
│   ├── friends.tsx
│   └── profile.tsx      # Square avatar (~18 px corners) + VIP halo
├── room/[id].tsx        # Chat + drag canvas + host-game modal
├── notifications.tsx
└── _layout.tsx
src/
├── api/client.ts        # axios + API_BASE_URL + resolveAssetUrl()
├── components/          # AvatarWithAura, DraggableMember, GamePanel, …
├── contexts/AuthContext.tsx  # global notification + DM sound poller
├── utils/sound.ts       # 3 synthesized SFX
└── ...
```

---

## Architecture Highlights

### Security
- JWT auth · bcrypt-hashed passwords
- Users can only mutate their own profile / coins
- Room-membership gate on message sending
- Room capacity hard-capped at 36

### Performance
- MongoDB indexes on hot fields
- 100 % async backend (Motor)
- All list endpoints have `.limit(50/100)` and projections
- Polling cadence kept relaxed (rooms 3 s, notifications 8 s, DM unread 6 s)

### Real-time
- Chat / member / game polling (no WS dependency required for MVP — WS endpoint scaffolded at `/ws/room/{room_id}`)
- Three distinct sound cues on arrival events (see Sound Effects table above)

### Refund-Aware Spend Tracking
`add_coins(user_id, amount, type, description, game_id=None)` tags every entry-fee transaction with the game / tournament id. Abort branches `update_many({gameId, type, amount<0}, {$set:{refunded:true}})` before issuing the positive refund. The Coins-Spent leaderboard `$match`-es `{refunded: {$ne: True}}`. A startup backfill heals historical aborts (legacy rows without `gameId` are matched by `userId + amount + createdAt±60s`).

---

## Database Schema (key collections)

### users
```js
{
  email, password, username, displayName,
  photoUrl,         // /api/static/avatars/default-N-name.png OR custom
  bio, coins, xp, level,
  achievements: [],
  currentRoomId, onlineStatus, lastSeen, createdAt,
  vipTier, vipBadgeId, auraType, auraColor, enlargedAvatar,
}
```

### coin_transactions  *(new fields highlighted)*
```js
{
  userId, amount, type, description, createdAt,
  gameId,            // NEW — links spend to its game/tournament
  refunded,          // NEW — true when the linked game was aborted
  refundedAt,        // NEW
}
```

### game_sessions
```js
{
  roomId, gameType, hostId, hostName,
  players: [{userId, username, displayName, photoUrl}],
  status: 'waiting' | 'completed' | 'aborted',
  minPlayers, maxPlayers, entryFee, pot,
  expiresAt, createdAt, completedAt, winnerId, gameState,
}
```

### tournaments
```js
{
  roomId, gameType, name, status, size,
  entryFee, pot, isPrivate, joinCode,
  players: [...], bracket: [...], winners: [...],
  createdBy, createdByName, createdAt, completedAt,
}
```

---

## Future Enhancements / Backlog

- Avatar picker in Profile → Edit (use the existing 3-pack + lock the other 6 behind VIP)
- Hover/press chat-row highlight + fade-in `timeAgo`
- Public `/api/tournaments/{tid}/cancel` endpoint (today the lone-joiner refund only runs via startup backfill)
- Refund-flag pattern to gifting flow
- Continue `server.py` modular split (~3.4 k lines)

---

## Development Notes
- **Hot reload**: Metro runs with `CI=true` → no HMR. After any frontend change run `sudo supervisorctl restart frontend` and wait ~40 s.
- **Backfills on startup** in `server.py`: `_ensure_indexes`, `_backfill_default_avatars`, `_backfill_refunded_aborts` — all idempotent.
- **Daily login** = 24 h since `lastLoginRewardAt`.
- **Room capacity** strictly enforced at 36.
- **Message history** capped at 50 recent messages per room.

## Testing
- Backend pytest suites under `/app/backend/tests/` — latest runs:
  - `test_default_avatars.py` 14/14 PASS
  - `test_refund_leaderboard.py` 6/6 PASS
- Test reports: `/app/test_reports/iteration_{N}.json`

## Support
- Backend logs: `/var/log/supervisor/backend.err.log`
- Frontend logs: `/var/log/supervisor/frontend.err.log`
- MongoDB: `mongodb://localhost:27017`

## License
MIT — Built with ❤️ on Emergent
