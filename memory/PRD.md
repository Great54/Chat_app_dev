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
