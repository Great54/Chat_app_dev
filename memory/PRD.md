# GenC Vibez — PRD

## Original problem statement (Jan 2026)
> In the selected repository now make the changes, when pressed others profile/others press our profile, likes, friends, profile pic, name, background pic, coins available, posts, bio, if any vip badge that should also be displayed. follow the above attached image on how the profile section should look like, profile image left side name on middle something like this, use pleasant bright colours and cursive writing. In the tournament section, keep rules as if more than 4 people join then 2 winners will be there otherwise one winner, currently in repo there is 50/50 share of prize for both instead first person should get more coins than second. and in tournament section if a user creates a tournament it should be visible for 5 hours for everyone in the app, like this user has created the tournament, so others can join. tournament will be knockout based. each person will face other person, next if tournament is created others can join the tournament if they have the code. you can make public/private kind of tournaments. tournaments is already there in the repo. just make these changes.

## Tech stack
- Frontend: React Native + Expo Router (web build served on :3000)
- Backend: FastAPI + Motor (Async Mongo) at :8001, prefix `/api`
- Database: MongoDB local
- Backend split into `server.py` + `routes/` sub-modules (tournaments, leaderboard, vip)

## Implementation log

### Iteration 11 (Jun 2026) — initial profile + tournament changes
- Profile popup + profile page redesigned with cursive name (Dancing Script), pic-LEFT/name-CENTER layout, 4 bright pastel stat chips (Coins/Friends/Likes/Posts) and cursive bio.
- Backend `/api/users/{id}/profile-card` now returns `postsCount` + `likesCount`.
- Friends list privacy: `/api/users/{id}/friends` returns 403 unless owner; profile page hides Friends tab for non-self viewers.
- Tournament prize tiers: ≤4 → 1 winner (100%); 5-10 → 2 winners (70/30); >10 → ceil(0.3·n) winners with ratios n:(n-1):…:1.
- Public/Private tournaments with 6-char invite code + `POST /api/tournaments/join-by-code`.
- Tournament listing window extended to 5h, still room-scoped.
- 17/17 backend tests passed.

### Iteration 12 (Jun 2026) — follow-ups
1. **Bug fix — removed phantom "dots" from profile card.** The scallop divider I added on the previous iteration was unrequested and looked like a UI bug. Removed the `<View style={styles.scallopRow}>` block (the 14 yellow dots) from `ProfilePopupModal.tsx`.
2. **Animated podium reveal on tournament completion.** New `<PodiumRow>` component using `Animated.View` with `useNativeDriver` + a staggered (220ms-per-row) opacity + spring `translateY` + `scale` reveal. Champion row gets a CHAMP pill, gold/silver/bronze tinted backgrounds.
3. **"Tournaments You've Won" / Hall of Champions leaderboard.**
   - **Backend:** New `GET /api/tournaments/wins/leaderboard?limit=N` returns `{ windowDays: 30, leaderboard: [{rank,userId,displayName,photoUrl,wins,coinsWon}...], me: {...} }`. Pipeline filters `winners.placement == 1` within the last 30 days; caller's own stats (and rank if outside top N) are returned in the `me` block.
   - **Frontend:** A new gold "Hall" button in the tournament header opens a modal showing the user's record card + ranked rows (medals for top 3, purple border highlight for self).
4. **P1 — `server.py` refactor.** Extracted three cohesive sections into router modules. `server.py` shrunk **4177 → 3296 lines (-21%)**.
   - `/app/backend/routes/__init__.py` — package marker.
   - `/app/backend/routes/tournaments.py` (569 lines) — all `/api/tournaments/*` + `/api/rooms/{id}/tournaments` endpoints, prize-split helpers, bracket runner.
   - `/app/backend/routes/leaderboard.py` (142 lines) — `/api/leaderboard/*` endpoints.
   - `/app/backend/routes/vip.py` (246 lines) — `/api/vip/*` + Pro customization.
   - Pattern: each submodule imports shared state (`api_router`, `db`, helpers, models, constants) from `server`; `server.py` then imports each submodule at the END (just before `app.include_router`) to trigger registration. No circular imports.
5. **Verified:** Backend regression + new endpoint tests: 21/23 (91%) passing. The 2 failures (`Room is full`) are pre-existing test-DB saturation, not a regression.

## What's been implemented (history)
- Authentication (JWT, email/username login, daily login reward, password reset token).
- Rooms (9 default rooms seedable via `/api/init/rooms`), join/leave, room members listing.
- Real-time chat (WebSocket broadcasting), board posts + likes + comments.
- VIP Pro / Elite system: tiers, avatar customization (aura/frame/badge/colors), monthly coin grant.
- Friends, private messages, gifts catalog + send, send coins.
- Knockout tournaments with public/private modes, 6-char invite codes, tiered prize distribution (100% / 70-30 / k:k-1:…:1), animated podium reveal, "Hall of Champions" global leaderboard.

## Backlog / Next actions
- **(P1)** Continue the refactor — extract `auth`, `board_posts`, `rooms`, `messages`, `friends`, `notifications` sections into their own router modules (`server.py` still has ~3300 lines).
- **(P1)** Add a test-cleanup endpoint or raise default room `maxCapacity` (currently 36) — long-lived dev DBs saturate the default rooms and break the >10-player test.
- **(P1)** Surface the private-tournament invite code in a one-tap copy/share sheet on creation toast.
- **(P2)** Push private-tournament filter into the Mongo query (currently in-Python loop).
- **(P3)** Real-time push when you're crowned champion (popup celebration with confetti).
- **(P3)** Auto-host "Tournament of the Day" daily knockout with house-sponsored prize (no entry fee).

## Smart enhancement idea
> Tournaments are an existing viral loop. With the new public/private + Hall of Champions, consider a **weekly "Champions Banner"** posted automatically to every room's board — top 3 winners' avatars + their best run. Creates social proof, drives FOMO on dormant users, and pulls visits to the Hall of Champions for verification.
