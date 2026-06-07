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
- **Leaderboard restructured** — replaced `Coins/Active` tabs with `Points Earned` (default) + `Coins Spent`; new endpoints `/api/leaderboard/points`, `/api/leaderboard/coins-spent`
- **Game resolution rewritten** — winner + runner-up share pot 70/30; `pointsEarned`, `gameWins`, `gameRunnerUps` tracked on user
- **Light-themed gameplay arena** — modal opens for hosts/joiners with hero image, status pill, players list, animated pulse and rules card
- **Game logos / banner images** added via Unsplash CDN (in `GAME_TYPES`); host modal uses image cards with CTA
- **Tournament feature** — knockout 4-player brackets; manual create / auto-fire at full; `/api/rooms/{id}/tournaments`, `/api/tournaments/{tid}/join`, `/start`, `/{tid}`; full bracket UI with podium + bracket viewer
- **Tournament button** placed in room header right next to Back arrow (`open-tournaments-btn`)
- **Coin gifting** — `POST /api/coins/send` (min 10, daily 1000 cap), `GET /api/coins/send-status`; new **Send Coins** action button in user profile popup
- **Bug fix** — `currentRoomId` was never being set (ObjectId vs string mismatch in `update_one`); fixed → all in-room actions (games, tournaments) now work end-to-end
- **.env bootstrap** — created `/app/backend/.env` and `/app/frontend/.env` (were missing, preventing server boot)

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
