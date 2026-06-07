# GenC Vibez — PRD

## Iteration 14 (Jun 2026) — square avatars + profile likes + View Posts + slow room glide

### Changes shipped
1. **Square avatars everywhere.** Both the in-room popup (`ProfilePopupModal`) and the full profile page (`app/profile/[id].tsx`) now use rounded-square avatar frames (`borderRadius: 8-14`) instead of circles.
2. **Profile like feature** (NEW backend + UI).
   - **Backend:** new `profile_likes` collection (unique compound index `targetUserId + likerId`).
   - **`POST /api/users/{user_id}/like`** — toggles a like from the caller toward target. Idempotent: a 2nd call un-likes. Self-like rejected (400). Response: `{ hasLiked, likesCount, userId }`.
   - **`GET /api/users/{user_id}/profile-card`** now returns `likesCount` (PROFILE likes) and a per-viewer `hasLiked` boolean. The legacy "likes received on board posts" count is preserved as `postLikesCount` for callers that still need it.
3. **Profile stats reduced to 3** per the user's spec: **Coins / Likes / Ads** (label "Ads" with value = friendCount). The Likes circle is **tappable** — taps optimistically flip the heart icon (outline ↔ filled), spring-animate the count, and call the toggle endpoint. The Posts circle is gone (replaced by the View Posts button).
4. **Bio moved below the 3 stat circles** in cursive style.
5. **"View Posts" button placed above the banner** as a prominent dark-pill chip with the user's post count badge. Tap opens a slide-up Modal that renders `<PostsTab userId>` so posts feel like a second page inside the profile.
6. **Room avatar tap-to-move slowed + interruptible.** `DraggableMember` now uses `Animated.timing` with `Easing.out(Easing.cubic)` and distance-aware duration (`600–1400 ms`). A running animation is tracked in a ref; the next tap or drag explicitly `.stop()`s it so the avatar always glides toward the LATEST tap point and never chains motions.

### Verified
- Backend: like toggle round-trip works (`hasLiked` flips, `likesCount` increments/decrements). Self-like returns 400 with friendly message. Profile-card includes `likesCount` + `hasLiked` + `postLikesCount`.
- Frontend: profile page screenshots confirm square avatars, 3-stat layout, Liked state (filled heart + pink active background), bio below, dark View Posts pill above banner.

## Backlog / Next actions
- (P1) Clean up dead `TABS` / `AboutTab` / `FriendsTab` code in `app/profile/[id].tsx` (no longer rendered).
- (P1) Continue server.py refactor (still ~3300 lines): extract `auth`, `board_posts`, `rooms`, `messages`, `friends`.
- (P1) Raise default room `maxCapacity` so long-lived dev DBs don't saturate the >10p test.
- (P1) One-tap copy/share sheet for the private-tournament invite code.
- (P2) Push private-tournament filter into the Mongo query.
- (P3) Notification ping to the liked user (`X liked your profile`).
- (P3) Auto-host "Tournament of the Day" + weekly Champions Banner.

## Smart enhancement idea
> The profile-like is a low-friction signal that's gold for personalization. Surface a **"People who liked your profile"** list inside the user's *own* full profile (above the Posts pill) — leverages the new collection without any extra API spend and creates a satisfying "who's checked me out" moment that drives daily opens. Pair with a "+1 like" haptic + heart particle burst for delight.

## Iteration 15 (Jun 2026) — Game Aborted modal fix + Gaming Arena Leaderboard theme

### Changes shipped
1. **Bug fix — "Game Aborted" modal kept re-opening every 1.5s after Done.**
   - Root cause: `GamePanel.tsx` polls `/rooms/:id/games` every 1.5s via `setInterval` set inside a `useEffect` keyed only on `roomId`. The interval callback closed over the initial `resultsShown` state (empty `Set`) and `resultModalGame` (`null`), so the `!resultsShown.has(g.id)` and `!resultModalGame` guards were ALWAYS true on every poll. Result: the aborted-game modal re-appeared every tick even after the user pressed Done.
   - Fix: introduced three `useRef`s — `resultsShownRef`, `dismissedRef`, `resultModalGameRef` — and refactored `loadGames()` to read/write refs (always current) instead of state. The Done button and Modal `onRequestClose` now add the game id to BOTH `dismissedRef` and `resultsShownRef` before clearing modal state, so the polling loop short-circuits permanently.
   - Verified by testing agent: 18s of continuous polling after pressing Done — modal did NOT reappear. (iteration_13.json)

2. **Leaderboard — Gaming Arena Champions theme (Option 3 from references).**
   - Rewrote `app/(tabs)/leaderboard.tsx`. Dark-navy arena background (`#070512`) with radial neon red & cyan glows + scanline highlights.
   - Header: neon-red "GAMING ARENA" eyebrow, bold white "Leaderboard" title, game-controller badge.
   - Tabs: pill-shaped, active = solid neon red with red shadow glow.
   - Top-3 podium: octagon-style rotated frames (#1 gold center+raised+trophy, #2 cyan left, #3 magenta right) each with neon shadow + numbered chip.
   - Ranks 4-10: dark glass-card list with gold metric pills.
   - VIP tier badges (Elite/Pro/regular) rendered inline.

### Verified by testing agent (iteration_13)
- Bug fix: 3/3 scenarios PASS, 0 console errors, 18s post-Done idle, no re-appearance.
- Leaderboard renders, both tabs trigger correct `/api/leaderboard/{points|coins-spent}` calls.

### Notes for future agents
- Backend `/app/backend/.env` was missing on this container at start of iteration_13; tester re-created it (`MONGO_URL=mongodb://localhost:27017`, `DB_NAME=genc_vibez`). If you see uvicorn `KeyError: 'MONGO_URL'`, restore this file.
