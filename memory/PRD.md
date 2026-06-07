# PRD — VIP PRO Customization

## Problem Statement (verbatim)
> in the attached repo I have introduced 2 features vip pro and elite, now I need to add certain things for vip pro, Using the attached reference images as inspiration, implement a VIP PRO membership system with a premium customization experience. Create a dedicated VIP PRO settings page where members can personalize their profile and chat appearance. VIP PRO users should receive 2,000 game coins automatically every month. Members should be able to select a custom chat text color, custom username color, custom private message box color, custom aura color, and choose one VIP badge from a small badge collection similar to the reference images. Users should also be able to enlarge their profile picture so it appears slightly larger than standard users throughout profiles, rooms, chats, and member lists. To reduce implementation complexity and credit usage, provide only four aura types initially: Glow Aura, Sparkle Aura, Frame Aura, and Smoke Aura. Users can select only one aura type at a time and apply a custom aura color to it. All customizations should instantly reflect across chats, profiles, boards, comments, and user lists. The VIP PRO section should have a premium dark-themed design similar to the attached screenshots, including customization popups for badge selection, aura selection, aura color selection, chat color selection.

## User Choices
- Badge collection: 24–32 ready-made badge images (emoji-rendered, zero asset cost)
- Monthly 2000 coin grant: on next login if 30 days passed since last grant
- VIP Pro Settings location: inside the existing VIP/Membership page as a new section
- Enlarged avatar scale: 1.25x
- Aura implementation: pure CSS/RN shadow effects (glow/sparkle/frame/smoke)

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`) + MongoDB (`vip_pro_app` DB)
  - User docs extended with: `vipBadgeId`, `auraType`, `auraColor`, `chatColor`, `usernameColor`, `pmBoxColor`, `enlargedAvatar`, `vipProMonthlyGrantAt`
  - New endpoints:
    - `GET /api/vip-pro/catalog` (public) — 32 badges + 5 aura types + color palettes
    - `GET /api/vip-pro/settings` — current user's settings + monthly grant info
    - `PUT /api/vip-pro/settings` — VIP Pro/Elite-only; updates customization
  - `POST /api/auth/login` automatically grants 2,000 coins to VIP Pro/Elite users every 30 days
  - Enriched responses: `/api/messages/{roomId}` (GET + POST), `/api/users/{id}/profile-card`, `/api/rooms/{id}/members`, `/api/messages/direct/{userId}`

- **Frontend** (Expo + React Native Web, `/app/frontend`)
  - `src/utils/vipProCustomization.ts` — catalog mirror + `getAuraStyle()` helper (CSS box-shadow + RN shadow)
  - `src/components/AvatarWithAura.tsx` — reusable circular avatar with aura, badge, and 1.25x scaling
  - `src/components/VipProSettingsModal.tsx` — premium dark-themed settings UI with live preview and 6 sub-pickers (Badge, Aura Type, Aura Color, Chat Color, Username Color, PM Box Color)
  - `VipShopModal.tsx` exposes the modal via a cyan→purple gradient row only when `vipTier === 'pro' | 'elite'`
  - Custom colors / aura / badge / enlarged avatar applied in `room/[id].tsx` chat messages, `DraggableMember.tsx` member list, `ProfilePopupModal.tsx` profile popup, `(tabs)/profile.tsx` profile screen, and `PrivateMessagesModal.tsx` direct messages

## Core Requirements (static)
- VIP Pro users get 2,000 game coins every 30 days, auto-granted
- 32-badge picker, single aura type at a time, single aura color
- Customizations reflect everywhere: chats, profiles, boards, comments, user lists
- Dark-themed UI with cyan accent border (matching reference screenshots)

## Implemented (2026-01)
- ✅ Backend models, constants, and 3 new endpoints
- ✅ Login-time monthly 2000-coin grant (idempotent for 30 days)
- ✅ Enriched message / profile-card / member / DM responses
- ✅ `VipProSettingsModal` with live preview + 6 sub-pickers
- ✅ `AvatarWithAura` reusable component with 1.25x enlargement
- ✅ Customizations applied in room chat, member list, profile popup, profile screen, private messages
- ✅ Backend tests: 15/15 pytest cases passing (100%)

## Backlog / Future
- P1: Move VIP Pro settings to its own dedicated `/vip-pro/settings` route (currently inside VIP Shop modal)
- P2: Replace emoji-rendered badges with custom designed PNG/SVG assets when artwork is ready
- P2: Make `_validate_color` strict (regex `^#[0-9A-Fa-f]{3,8}$`)
- P2: Bulk `$in` lookup in `get_room_members` to avoid N+1
- P2: Animated aura variants (rotating sparkle particles, animated smoke)

## Test Credentials
See `/app/memory/test_credentials.md`.
