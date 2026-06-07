# GenC Vibez — PRD

## Problem Statement (verbatim, from this session)
"in this repo now modify the existing private messaging in the flow, default when user signs in or sign up they should be placed in a room where they left earlier(if new user then place them in world vibes room, if that room is full then next room (whichever is fine). next in the room they will find private messaging, I have already implemented in the repo but just make changes like in this attached image. if a user presses that icon -> no of private messages received, on that a little pink or green dot stating they have unread it, next they can press on that and chat, let all these themes be light coloured. in th3 3rd image I attached you can see the options, those options also need to be updated and try to use same dimensions as present in image and also UI it is colourful bright"

## User personas
- **Returning chatter** — wants to land back in their last room instantly on login.
- **New signup** — should be dropped into the busiest active community (World Vibez) without ceremony.
- **DM user** — needs a fast, bright, mobile-style inbox with quick actions (View Profile, View Message, Report/Block, Delete) on any conversation.

## Core requirements (static)
1. Auto-join the room on login/signup. Returning users → last room; new users → World Vibez; fallback → next non-full room. Show a "Joining <room>…" indicator.
2. The room screen's chatbox icon shows a pink dot when there are unread DMs.
3. The Private Messages panel is light + colourful — Messages / Settings tabs, bright blue conversation rows, pink unread dot, tap-to-reveal options popup (View Profile / View Message / Report|Block / Delete) sized like the screenshot.
4. Settings tab — allow messages from (Everyone / Friends / Nobody), notifications toggle, About card.
5. Main chat room stays dark.

## What's been implemented (this session — Jun 2026)
**Backend (`/app/backend/server.py`)**
- `POST /api/rooms/auto-join` — picks last room → World Vibez → first non-full; performs join atomically; returns `{ roomId, roomName, wasResumed }`.
- `/rooms/{id}/join` now also writes `lastRoomId`; `/rooms/{id}/leave` clears `currentRoomId` but **preserves** `lastRoomId` so the user can be auto-resumed.
- `GET /api/messages/direct/unread/total` — count of unread DMs for the badge dot.
- `DELETE /api/messages/direct/conversation/{user_id}` — deletes the full DM thread.
- `GET / PUT /api/users/me/dm-settings` — `allowMessagesFrom` (everyone|friends|nobody), `notificationsEnabled`, `blockedUserIds`.
- Backend `.env` was missing; created with `MONGO_URL=mongodb://localhost:27017`, `DB_NAME=genc_vibez`.

**Frontend**
- `AuthContext`: post-login/register navigates to `/(tabs)?autojoin=1` and exposes `autoJoin()`.
- `app/(tabs)/index.tsx`: consumes `?autojoin=1`, shows the "Joining <RoomName>…" overlay (`data-testid="auto-join-indicator"`), then `router.replace('/room/<id>')`.
- `app/room/[id].tsx`: polls `GET /messages/direct/unread/total` every 3s; renders `data-testid="dm-unread-dot"` on the chatbox icon.
- `src/components/PrivateMessagesModal.tsx`: full redesign — light/bright theme, Messages/Settings tabs (yellow underline on active), blue conversation cards with avatar + message + `from <user>` + time + pink unread dot, tap-row reveals 2×2 options panel (View Profile / View Message / Report|Block / Delete), light chat view with composer and pink send button, Settings tab with allow-message chips + notifications toggle + about card.
- `metro.config.js` + `package.json`: `CI=true` for Expo web (container's inotify limit is RO-fixed at 12288, so file-watching is disabled in supervisor).

## Backlog (P0 / P1 / P2)
- **P1** Append new sent DM to local state instead of refetching, to avoid the ~2s flash on send.
- **P1** Switch back to React-style optimistic mark-as-read so the pink dot disappears the moment a user opens the chat view (instead of after the next poll).
- **P2** Settings: surface the blocked-users list with unblock + report-history.
- **P2** Replace polling with a WebSocket event (`dm:new`) so the badge updates in real time.
- **P2** `PUT /dm-settings` should 422 on invalid `allowMessagesFrom` values instead of silently dropping them.
- **P2** Migrate `props.pointerEvents` → `style.pointerEvents` (deprecated RN warning, pre-existing).

## Verified flows (iteration 10)
- Backend: 8/8 pytest cases PASS — auto-join (new + resume), join/leave preserving lastRoomId, DM unread total, delete conversation, dm-settings defaults + PUT persistence.
- Frontend: auto-join indicator, room landing, unread dot, DM modal tabs, conversation row → options popup, View Message → chat view, Settings chips + toggle (persisted).
