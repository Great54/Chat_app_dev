# GenC Vibez — PRD

## Original problem statement (Jan 2026)
> In the selected repository now make the changes, when pressed others profile/others press our profile, likes, friends, profile pic, name, background pic, coins available, posts, bio, if any vip badge that should also be displayed. follow the above attached image on how the profile section should look like, profile image left side name on middle something like this, use pleasant bright colours and cursive writing. In the tournament section, keep rules as if more than 4 people join then 2 winners will be there otherwise one winner, currently in repo there is 50/50 share of prize for both instead first person should get more coins than second. and in tournament section if a user creates a tournament it should be visible for 5 hours for everyone in the app, like this user has created the tournament, so others can join. tournament will be knockout based. each person will face other person, next if tournament is created others can join the tournament if they have the code. you can make public/private kind of tournaments. tournaments is already there in the repo. just make these changes.

## Tech stack
- Frontend: React Native + Expo Router (web build served on :3000)
- Backend: FastAPI + Motor (Async Mongo) at :8001, prefix `/api`
- Database: MongoDB local

## What's been implemented (this iteration — Jun 2026)

### Profile (popup + full page)
- Redesigned `ProfilePopupModal` and `app/profile/[id].tsx` with the user's reference layout:
  - Background banner image (top), profile picture on the LEFT of the banner, display name in CENTER in **cursive (Dancing Script / Great Vibes)**.
  - Bright pastel theme (cream `#fffaf3` card, gold/peach banner, sky-blue / pink / mint / amber stat chips).
  - Status pill, VIP badge crown on avatar, scallop divider, gradient "View Profile" CTA.
  - 4-stat row: **Coins, Friends, Likes, Posts** (each a colored bordered chip with cursive value).
  - Cursive **Bio** below stats.
  - VIP Pro/Elite badge pills with ribbon for Elite users retained.
- Backend `/api/users/{user_id}/profile-card` now returns `postsCount` and `likesCount` aggregated across rooms.
- **Privacy:**
  - `/api/users/{user_id}/friends` now returns **403** unless `user_id == current_user.id`. Only owners see their friends list.
  - Profile page hides the **Friends tab** for non-self viewers; only counts remain visible.
  - Likes count is shown but the list of likers is not exposed (already behavior — frontend never requested it for other users).

### Tournaments
- Prize distribution rewritten in `_run_tournament` + new helpers (`_winners_count`, `_prize_split`):
  - **≤4 players** → 1 winner takes 100% of the pot.
  - **5–10 players** → 2 winners, 70% / 30%.
  - **>10 players** → `ceil(0.30 × n)` winners, with ratios `n:(n-1):…:1` (e.g. 11p → 4 winners → 44/33/22/11 of pot 110).
- All prize splits are integer math and always sum exactly to the pot (remainder → champion).
- Placements are derived from the **knockout elimination round** (later elimination = higher placement). Champion never eliminated → 1st place.
- Tournament visibility window extended from 2h → **5h** (`TOURNAMENT_VISIBLE_HOURS = 5`). Tournaments remain **room-scoped** (per user request — not app-wide).
- **Public / Private tournaments:**
  - `TournamentCreate` accepts `isPrivate: bool` (default `false`).
  - Private tournaments get a random **6-character invite code** (alphabet `A-Z` minus `I,O` + digits `2-9`).
  - `GET /api/rooms/{room_id}/tournaments` filters out private tournaments unless the viewer is the creator or already joined.
  - `POST /api/tournaments/{tid}/join` rejects private tournaments with 403 unless the caller is the creator / already in the player list.
  - New endpoint `POST /api/tournaments/join-by-code` lets anyone in the host's room join with the code.
  - Join code is only returned to creator / joined players via the serializer (`viewer_id`-gated).
- Frontend `TournamentModal`:
  - Header now has a **Code** button (opens "Join with code" mini-modal) alongside **New**.
  - Rewards banner updated to show the 3 tiers (≤4p / 5-10p / >10p).
  - Each tournament card shows a **PUBLIC** / **PRIVATE** pill and the invite code badge (creator + joined players only).
  - Create flow has a **Public / Private** chooser and a dynamic Reward preview that renders the exact list of winners + coin amounts using the same `prizeShares()` mirror function on the frontend.
  - Detail screen displays a copy-friendly **Invite code** card while the tournament is in lobby (creator / joined players only) and renders variable-length winners table after completion.

### Test verification
- 17 / 17 backend pytests passing (see `/app/test_reports/iteration_11.json`).
- Manual end-to-end (curl): public tournament visible to all room members; private hidden; direct-id 403 for non-participants; join-by-code works; 2-player tournament awards full pot to the one winner; profile-card now includes postsCount + likesCount.

## What's been implemented (history)
- Authentication (JWT, email/username login, daily login reward, password reset token).
- Rooms (9 default rooms seedable via `/api/init/rooms`), join/leave, room members listing.
- Real-time chat (WebSocket broadcasting).
- VIP Pro / Elite system: tiers, customizations (avatar aura/frame/badge/colors), monthly coin grant, priority Elite welcome.
- Board posts + likes + comments per room (with feed and global user-posts view).
- Friends (send/accept/remove), private messages, gifts catalog + send, send coins.
- Notifications (in-app), activity feed (self + friends).
- Knockout tournaments with the previous 50/50 split (now upgraded per this iteration).

## Backlog / Next actions
- **P1 — Tournament chat broadcast for private codes:** Currently private tournaments suppress the system message (since others can't join). Consider whispering the code to the creator's DM thread for sharing.
- **P1 — Refactor `server.py` (4118 lines):** Split into modules (auth, profile, rooms, tournaments, board, vip) — code review feedback from testing agent.
- **P2 — Move private-tournament filter into the Mongo query** (currently in-Python loop) for scale.
- **P2 — Tournament XP / leaderboard view** that aggregates winners across all rooms.
- **P3 — Share sheet** in the invite-code card (auto-copy to clipboard with a toast).
- **P3 — Animated podium reveal** on tournament completion.

## Smart enhancement idea
> Tournaments are a strong viral engagement loop. Consider a **"Tournament of the Day"** banner on the room board that auto-creates a small free-entry tournament every 24 hours with sponsored prizes — pulls dormant users back into rooms and creates a daily ritual without coin friction.
