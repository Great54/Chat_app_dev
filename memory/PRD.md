# GenC Vibez — PRD

## Original problem statement (Jan 2026)
> Profile section: when pressed on another's profile (or they press ours), display likes, friends, profile pic, name, background pic, coins, posts, bio, and VIP badge. Use pleasant bright colours and cursive writing. Tournament section: if >4 people join then 2 winners, otherwise 1 winner. 1st should get more coins than 2nd. Tournaments visible for 5 hours per room. Knockout based, each person faces other person. Public/private tournaments with join code.

## Tech stack
- Frontend: React Native + Expo Router (web build served on :3000)
- Backend: FastAPI + Motor at :8001, prefix `/api`
- Database: MongoDB local
- Backend modularized: `server.py` + `routes/{tournaments,leaderboard,vip}.py`

## Implementation log

### Iteration 11 — initial profile + tournament work
- Cursive profile design + tiered tournament prizes + public/private tournaments + 5h visibility window. (17/17 tests passed.)

### Iteration 12 — dots fix + podium + Hall of Champions + P1 refactor
- Removed unrequested scallop divider dots.
- Animated podium reveal in TournamentDetail (`Animated.View` staggered springs).
- New `GET /api/tournaments/wins/leaderboard` global Hall of Champions endpoint + UI modal.
- Extracted `routes/tournaments.py`, `routes/leaderboard.py`, `routes/vip.py` from server.py (-21% lines).

### Iteration 13 — minimal "in-room" peek + full-profile redesign (Jun 2026)
User wanted a clean separation:
- **Popup ("in-room" peek)** = avatar + name + VIP badge + coins + View Profile only. No stats, no actions, no online label (dot is enough), no Report/Block.
- **Full profile = where ALL interaction lives** — Add Friend, Message, Gift, Send Coins, and post-likes are all here.

#### Changes shipped
1. **`ProfilePopupModal.tsx` — radically simplified.** Avatar LEFT, identity RIGHT layout (no banner anymore). The right column shows the cursive display name, `@username`, VIP badge pill (`PRO`/`ELITE` only — no separate "Online" word), and a Coins pill. A single gradient `View Profile` button is the sole CTA. The previous stat chips (Friends/Likes/Posts), 4-button action grid (Friend/Message/Gift/Coins), and Report|Block row were removed. Online status is conveyed silently by the dot on the avatar.
2. **`app/profile/[id].tsx` — avatar-LEFT redesigned.** Removed the centered avatar-over-banner layout. New `headerSplit` row: avatar LEFT (130×130 frame with VIP gradient, crown badge, online dot), identity column RIGHT with cursive `displayName`, `@username`, inline VIP badges and **bio rendered directly** (so the "About" section is unnecessary — `"No bio yet."` is shown when empty).
3. **Tabs removed.** `About`, `Friends`, and `Photos` tabs are gone. The page now renders ONE content area: a "Posts" section header followed by `<PostsTab>` showing all the user's posts across rooms. (Friends list was already restricted to self by privacy rules and is now no longer exposed at all on the profile page.)
4. **Send Coins button added to the full profile** quick-actions row (`Add Friend / Message / Gift / Coins`). Wired to `SendCoinsModal` using `useAuth().user.coins`.
5. **Bio inline shown in cursive** with a soft purple tint to feel handwritten.

## Backlog / Next actions
- **(P1)** Continue the refactor — extract `auth`, `board_posts`, `rooms`, `messages`, `friends` (server.py still ~3300 lines).
- **(P1)** Cleanup unused tab code in `app/profile/[id].tsx` (the `AboutTab`/`FriendsTab` sub-views and the related state are still in the file even though they are no longer rendered — safe but adds noise).
- **(P1)** Raise default room `maxCapacity` (=36) so long-lived dev DBs don't saturate the >10p tournament test.
- **(P1)** One-tap copy/share sheet for the private-tournament invite code.
- **(P2)** Push private-tournament filter into the Mongo query.
- **(P3)** Auto-host "Tournament of the Day" + weekly Champions Banner auto-posted to room boards.

## Smart enhancement idea
> The new ultra-minimal popup makes it harder to spam Add Friend / Gift from chat (a good thing for behavior). To recoup the discoverability, sprinkle a **"+ Add Friend" suggestion chip** on the View Profile screen the first time someone lands on a stranger's profile — drives engagement without cluttering the in-room peek.
