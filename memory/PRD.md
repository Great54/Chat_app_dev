# GenC Vibez — PRD

## Problem statement (verbatim from user, latest iteration)
> In the current attached repo, make these changes. In the leaderboard I want first points spent then the coins spent leaderboard. I can see there are two games, but if I press it its not working currently please check why game play is not working, make the gameplay interface theme light, see here it is dark themed for gameplay. and give some images for these games and also for the games logo I need images. Rules are like this — spend 10 coins and play, only winner and runner up will get coins and rest will be eliminated. In each room there should be tournament option, just right side of back option so that knockout tournaments will be scheduled shortly based on that for each win user will be rewarded, and final 3 winners will have VIP subscriptions, extra coins and all. Earning system should be: 100 coins on registration, 50 coins daily login bonus, other users can send up to 1000 coins per day.

## Stack
- **Mobile**: React Native (Expo Router) — runs on web via React-Native-Web
- **Backend**: FastAPI + Motor (async Mongo)
- **DB**: MongoDB (`genc_vibez`)

## Personas
- **Player** — joins rooms, hosts/joins games & tournaments, sends/receives coins
- **Spender / Whale** — earns leaderboard rank via coins spent (gifting, hosting, tournaments)
- **Champion** — wins tournaments to earn VIP Pro and bonus coins

## Core requirements (static)
- 100 coin sign-up bonus
- 50 coin daily login bonus
- 10 coin entry games (Higher Card, Dice Roll) — winner gets 70 % of pot + 10 pts; runner-up gets 30 % + 5 pts
- Knockout tournaments (4 players) — 1st: VIP Pro + 800 🪙 + 30 pts · 2nd: 400 🪙 + 20 pts · 3rd: 200 🪙 + 10 pts
- User-to-user coin gifting (min 10, max 1000 outgoing per 24h)
- Leaderboards: Points Earned (default) and Coins Spent

## Implemented in this iteration (Jan 2026)
- **Dynamic tournament size & entry fee** — creator picks any size 2–32 and any entry fee 1–100 000 🪙 via two-step modal (Step 1: pick game · Step 2: name + size + fee, with presets and live pot preview). Bracket auto-builds for any size with byes for odd counts; rounds labelled `final / semifinal / quarterfinal / round-of-16 / round-of-N`.
- **Dynamic game entry fee + max players** — `POST /api/rooms/{id}/games` accepts optional `entryFee` (1–100 000) and `maxPlayers` (2–32). Host modal first picks a game, then opens a Config sheet with fee & max-players presets and live payout preview.
- **50 / 50 pot split** — for both games and tournaments, the pot is divided equally between winner and runner-up (winner gets the extra coin on odd pots). Champion still earns VIP Pro (30 days) + 30 pts as a perk; runner-up +20 pts; 3rd +10 pts (no pot share for 3rd).
- **VIP downgrade guard** — champion grant no longer downgrades a higher tier (e.g. 'elite' stays 'elite', only `vipExpiresAt` extended).
- **Validation hardening** — `create_tournament` now uses `is not None` defaulting so explicit `0` is rejected.

## Implemented previously
- Leaderboard restructured (`Points Earned` first, `Coins Spent` second)
- Light-themed gameplay arena with Unsplash hero images, taglines, "How it works" card
- Tournament button next to Back arrow in room header
- User-to-user coin gifting via "Send Coins" on profile popup — min 10, max 1000 outgoing per 24 h
- Bug fix: `currentRoomId` not being set due to ObjectId/string mismatch
- `.env` bootstrap (backend + frontend)

## What works (verified)
- 18/18 backend tests pass: `pytest /app/backend/tests/test_games_tournaments_gifting.py`
- Visual smoke: leaderboard tabs render correctly; tournament modal lists/creates; host modal shows images & taglines; gameplay arena renders in light theme

## Routes added (this iteration)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/leaderboard/points` | Points-earned leaderboard |
| GET | `/api/leaderboard/coins-spent` | Aggregated coin-spend leaderboard |
| GET | `/api/coins/send-status` | Caller's 24 h gift usage |
| POST | `/api/coins/send` | Send coins to another user |
| GET | `/api/rooms/{id}/tournaments` | List tournaments in a room |
| POST | `/api/rooms/{id}/tournaments` | Create tournament in a room |
| POST | `/api/tournaments/{tid}/join` | Join tournament lobby |
| POST | `/api/tournaments/{tid}/start` | Manual start by creator |
| GET | `/api/tournaments/{tid}` | Single tournament detail |

## Files touched
- `/app/backend/server.py` — rewards split, tournament code, gifting, leaderboards, ObjectId bug fix
- `/app/backend/.env` — created
- `/app/frontend/.env` — created
- `/app/frontend/src/components/GamePanel.tsx` — light gameplay arena + image cards
- `/app/frontend/src/components/TournamentModal.tsx` — new
- `/app/frontend/src/components/SendCoinsModal.tsx` — new
- `/app/frontend/src/components/ProfilePopupModal.tsx` — wired Send Coins action
- `/app/frontend/app/(tabs)/leaderboard.tsx` — rewrote with Points/Coins-Spent tabs
- `/app/frontend/app/room/[id].tsx` — Tournament button + modal mount
- `/app/backend/tests/test_games_tournaments_gifting.py` — 18 tests (added by testing agent)

## Backlog / Next actions
- **P1**: Persist `vipExpiresAt` countdown on `/auth/me` so client can show "VIP expires in N days"
- **P2**: Allow tournaments with entry fee > 10 (boss / weekend events)
- **P2**: Real-time WebSocket updates for tournament status (currently 3 s polling)
- **P2**: Tournament size selector (2/3/4) at create time — backend already supports
- **P3**: Refactor `server.py` (3 293 lines) into modular routers
- **P3**: Move `TOURNAMENT_REWARDS` to a settings collection for live tuning
- **P3**: `?include=all` flag on tournament list for history beyond 2 h cutoff

## Test credentials
See `/app/memory/test_credentials.md`. Default password convention: `pass1234`.
