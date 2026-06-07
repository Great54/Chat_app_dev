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

## Iteration 16 (Jun 2026) — Cloudflare 520 RCA, VIP scale 1.18, scattered room placement

### Changes shipped
1. **Cloudflare 520 on Forgot Password — RCA & recovery.** Backend had crashed because `/app/backend/.env` was missing on the container (uvicorn `KeyError: 'MONGO_URL'`). Recreated `/app/backend/.env` with `MONGO_URL=mongodb://localhost:27017` + `DB_NAME=genc_vibez`. Verified `POST /api/auth/forgot-password` returns 200 with generic success message on the external preview URL.
2. **VIP avatar scale reduced 1.25 → 1.18** in three locations: `VIP_PRO_AVATAR_SCALE` constant, `VIP_STYLES.elite.avatarScale` in `DraggableMember.tsx`, and the doc comment in `AvatarWithAura.tsx`.
3. **Scattered initial placement for room avatars.** Replaced the strict row-grid (`row = idx/perRow, col = idx % perRow`) with a deterministic Halton low-discrepancy sequence (base-2 for X, base-3 for Y) plus a small ±12% per-userId hash jitter. Result: members are spread across the full room canvas in different X **and** Y positions instead of stacked in a perfect line at the top, while ordering is preserved (lower `initialIndex` → Halton-earlier cell) and positions are stable across reloads.

### Verified by testing agent (iteration_14)
- 4/4 scenarios PASS. forgot-password 200, both scale constants = 1.18, avatars rendered at e.g. (146,69) / (88,136) / (223,31) in a 374×294 canvas — clearly not a row. Position stable on reload. Tap-to-move still glides.

### Important environment note
- Expo Metro is launched with `CI=true` in supervisor → **no HMR**. After any frontend code change main agent MUST `sudo supervisorctl restart frontend` and wait ~40s for the web bundle to recompile. If a recent change is "missing", suspect the stale bundle first.
- If backend returns 502/520 again, check `/var/log/supervisor/backend.err.log` — most likely cause is `/app/backend/.env` being absent.

### Smart enhancement idea
> Right after the scatter, run a single Lloyd's relaxation step server-side (or client-side memoized) so avatars settle into a Voronoi-balanced layout. Adds zero perceived load time and prevents the rare case where two members' Halton+jitter coords overlap. Combined with a tiny entrance "pop" animation (Animated.spring scale 0→1) it turns the room screen into a satisfying micro-moment of life that increases the average time-in-room.

## Iteration 17 (Jun 2026) — Three sound effects (room enter / notification / message)

### What shipped
1. **`/app/frontend/src/utils/sound.ts`** — new utility that synthesizes 3 distinct SFX via the Web Audio API (no asset files, zero network requests, ~6 KB). Distinct frequency signatures so they can be told apart even in monkey-patched headless tests:
   - `playRoomEnterSound()` — airy "whoosh-pop", sine sweep 220 → 660 Hz + soft noise burst.
   - `playNotificationSound()` — bright two-note "ding", E6 (1318.51 Hz) → A6 (1760 Hz) + E7 sparkle.
   - `playMessageSound()` — soft "pop-tap", 660 → 420 Hz sine + 1240 Hz triangle ping.
   Features: AudioContext singleton, one-time user-gesture autoplay-unlock listener (pointerdown / keydown / touchstart), per-tag throttle (220-350 ms) to prevent burst stacking, `Platform.OS === 'web'` guard (no-op on native).

2. **`/app/frontend/src/contexts/AuthContext.tsx`** — added a global polling effect (every 8s notifications, 6s DM unread total) that:
   - plays `playNotificationSound()` when a brand-new id appears in `/notifications`,
   - plays `playMessageSound()` when `/messages/direct/unread/total` strictly increases,
   - seeds dedup refs silently on first poll so history doesn't replay sounds on app launch,
   - clears refs + intervals on logout / unmount.

3. **`/app/frontend/app/room/[id].tsx`** — added per-room dedup refs (`seenMemberIdsRef`, `seenMessageIdsRef`) that:
   - silently seed inside `loadRoomData()` (first hydration),
   - in `refreshRoomData()` (3s poll) play `playRoomEnterSound()` when a new memberId appears (excluding self) and `playMessageSound()` when a new messageId arrives whose `senderId !== user.id`.

### Verified (iteration_15)
- Static code review PASSED across all 3 sound paths (Web Audio gating, dedup correctness, self-exclusion, throttle, cleanup).
- REST regression PASSED: frontend HTTP 200, login 200, /api/auth/me 403 unauth, /api/messages, /api/notifications, /api/rooms/:id/members all 200.
- Manual smoke: page loads with zero JS errors, `AudioContext` available in window.
- Runtime oscillator-call live test was BLOCKED by a browser_automation wrapper pre-nav timeout (10s budget vs Expo cold-bundle time); not a code bug.

### Known follow-up
- (P2) Add a Settings toggle that calls `setSoundsEnabled(false)` and persists in storage. The mute hook is already in `sound.ts`.
- (P2) Add native sound support via `expo-audio` when targeting iOS/Android — currently no-op on native.

### Smart enhancement idea
> Add a single-tap "sound preview" row inside Profile → Preferences ("Hear room-enter / notification / message") that lets users assign their own pack from a curated list of 3-4 themed packs ("Arcade", "Cozy", "Minimal", "Lofi"). Sound personalization is a tiny effort but materially boosts identity attachment and the perceived polish of the app — and it's a natural upsell hook for a future VIP-only premium pack.

## Iteration 18 (Jun 2026) — Default profile avatars (9 cute astronaut animals)

### What shipped
1. **9 bundled default avatars** under `/app/backend/static/avatars/` — `default-1-panda.png … default-9-koala.png` (panda, corgi, kitten, alien, penguin, bunny, fox, robot, koala). Sliced from the 1254×1254 master grid into 418×418 PNGs (~260 KB each). Served via the existing K8s-ingress-routed mount at `/api/static/avatars/<name>.png`.
2. **`pick_random_default_avatar()`** helper in `server.py` returns one of the 9 URLs at random.
3. **`POST /api/auth/register`** now sets `photoUrl = pick_random_default_avatar()` for every new user (previously `None`).
4. **Startup backfill `_backfill_default_avatars()`** rewrites every existing user whose `photoUrl` is null/empty/stale (regex `/^/api/static/avatars/default-/` not in current valid set) → ensures legacy users aren't blank and old filename variants are auto-healed.
5. **`/app/frontend/src/api/client.ts`** — exported `API_BASE_URL` and added a `resolveAssetUrl(url)` helper for native-platform compatibility (web resolves relative URLs against page origin automatically).

### Verified (iteration_16)
- 14/14 pytest backend cases PASS (`/app/backend/tests/test_default_avatars.py`):
  - All 9 PNGs served (HTTP 200, image/png, valid PNG magic).
  - Register → random default URL; 10 registrations → 8 distinct (entropy good).
  - Backfill purges null/empty/stale URLs; no legacy filenames left.
- Frontend: avatar-tester-1's profile renders the bunny astronaut at 418×418 (verified, screenshot attached in test report).

### Note
- Earlier in this iteration a wrong asset URL was downloaded (produced leaderboard-screenshot crops). Re-sliced from the correct 1254×1254 grid; backfill auto-rewrote affected users.

### Smart enhancement idea
> Add an **avatar picker tile-grid** in Profile → Edit (3×3 of the same 9 astronauts + a 10th "Upload your own" tile). Lets users quickly switch their default to a different astronaut without uploading, gives them an instant identity moment, and the same 9-image set can later seed a **paid VIP avatar pack** (different art style, e.g. cyberpunk animals) — small build, real personalization upside.

## Iteration 19 (Jun 2026) — Chat row layout (whitespace + vertical centering)

### What shipped
- Redesigned `renderMessage` in `app/room/[id].tsx`: replaced the 3-column layout (`avatar | senderCol(width=84) | messageCol(flex=1)`) — which produced an awkward white-space gap between username and message and left-anchored everything to the top of the row — with a clean 2-column layout:
  - **left**: avatar (now bumped from 32 → 40 px so the cute astronaut PFP reads well),
  - **right**: a single content column that stacks `senderName` (small, colored, single-line) above `messageText`.
  Wrapped in `messageRow` with `alignItems: 'center'` and a `minHeight: 40` content col so name + text are vertically centered on the avatar baseline.
- Made the existing legacy `.avatar` / `.avatarImg` styles circular (`borderRadius: 16`) for consistency.

### Verified (manual)
- Sent two messages from the host account in "World Vibez": both rows render the bunny astronaut avatar with sender name (`varr`) tightly above the message (`hello` / `Hi`) and no horizontal gap. Screenshot attached.

### Smart enhancement idea
> Add a **subtle hover/press highlight** on chat rows (light translucent purple at `rgba(124,58,237,0.05)`) plus a `time-ago` timestamp on the right that fades in on hover. Makes the chat feel more "live" without taking screen real estate from the avatars — a tiny polish lever that closes the gap between MVP-chat and a premium social product.

## Iteration 20 (Jun 2026) — Square chat avatars (no border for non-VIP)

### What shipped
- Added a `shape?: 'circle' | 'square'` prop to `src/components/AvatarWithAura.tsx`. When `square`, the avatar wrapper + image use a small radius (~16% of size, e.g. 6 px on a 40 px avatar) instead of a full circle.
- VIP aura (glow / colored ring) is now only applied to VIP users (`isVip = !!vipTier`). Non-VIP users get a plain bordered-less avatar in every shape mode.
- `app/room/[id].tsx` chat row passes `shape="square"` to `AvatarWithAura`, so chat messages show square cute-astronaut PFPs without the doubled neon ring effect.

### Verified (manual)
- Reloaded `/room/<id>`: `varr`'s chat row now renders a clean 40 × 40 square bunny avatar with no border, name + message tightly stacked next to it. VIP-tier users would still get their aura because of the `isVip` gate.

### Smart enhancement idea
> Apply the same `shape="square"` treatment to **room-canvas member tiles** (DraggableMember). The default astronaut PFPs already include a neon-ring inside the artwork — using a square frame lets that built-in ring breathe and gives the room a sticker-board / Polaroid aesthetic. Keep VIPs circular with their gold/elite halo so the tier difference becomes a free visual cue ("squares = members, circles = VIP").
