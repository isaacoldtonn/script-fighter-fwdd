# Script Fighter: Arcade Edition
## CT117-3-2-FWDD — Ng Juin Khai (TP075949)

---

## What This Project Is

A real-time 2-player educational hybrid game that teaches Python Control Flow
through competitive gameplay. Two players fight by answering Python questions.
Correct + faster answer = deal HP damage to opponent. First to 0 HP loses.

**Physical component:** Shared laptop as arcade cabinet + physical keyboard
**Digital component:** This web app (host on laptop, players on mobile phones)
**Connection mechanism:** QR code on lobby screen → players scan with phone

---

## How The Game Works

1. Host logs in → opens /lobby → QR code + session code appears
2. Player 1 scans QR on phone → joins as player1 (keys: A/S/D)
3. Player 2 scans QR on phone → joins as player2 (keys: J/K/L)
4. Host clicks Start Match → Python Control Flow question sent to both phones
5. Players read question on their phone → press their key on the SHARED LAPTOP keyboard
6. Server evaluates: correct + faster answer = deal damage (easy=10, medium=20, hard=30 HP)
7. Round result + explanation shown on both phones (formative feedback)
8. Repeat until someone's HP hits 0 → match ends → XP awarded

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS, Axios, socket.io-client,
  react-hook-form, Zod, react-qr-code, react-hot-toast
- **Backend:** Node.js + Express, Socket.io, bcrypt, jsonwebtoken, express-validator,
  @supabase/supabase-js, qrcode, uuid, cookie-parser, multer
- **Database:** Supabase (PostgreSQL) — accessed ONLY from server, never from client
- **Storage:** Supabase Storage bucket `avatars` (public) — profile pictures only
- **Deployment:** Frontend → Vercel | Backend → Railway (port 8080) | DB → Supabase

---

## Monorepo Structure

```
script-fighter/
├── client/          ← Next.js frontend (deployed to Vercel)
│   ├── app/
│   │   ├── page.tsx                ← root: checks /api/auth/me, routes to /home or /login
│   │   ├── (auth)/register/page.tsx
│   │   ├── (auth)/login/page.tsx
│   │   ├── home/page.tsx           ← main landing after login: host/join cards, quick stats
│   │   ├── lobby/page.tsx          ← host screen, keyboard listener lives here
│   │   ├── join/page.tsx           ← QR landing page
│   │   ├── hud/page.tsx            ← player mobile game screen
│   │   ├── result/round/page.tsx   ← post-round feedback
│   │   ├── result/match/page.tsx   ← match end summary
│   │   ├── history/page.tsx
│   │   ├── leaderboard/page.tsx
│   │   └── profile/page.tsx        ← own profile: avatar/info/password edit cards
│   ├── components/
│   │   ├── NavBar.tsx              ← fixed top bar on every protected page, mobile hamburger
│   │   ├── UserAvatar.tsx          ← picture or initials-on-color-hash fallback
│   │   └── UserProfileModal.tsx    ← read-only public profile popup (opened from leaderboard rows)
│   ├── lib/
│   │   ├── axios.ts                ← singleton Axios instance, baseURL from env
│   │   └── socket.ts               ← singleton Socket.io client
│   ├── hooks/useSocket.ts
│   └── middleware.ts               ← route protection (sf_authed marker cookie check — see Critical Rules)
│
├── server/          ← Node.js + Express + Socket.io (deployed to Railway)
│   ├── index.js                    ← listens on port 8080 (Railway default)
│   ├── routes/
│   │   ├── auth.js                 ← register, login, logout, /me
│   │   ├── sessions.js             ← create session, validate QR token, join-by-code
│   │   ├── matches.js              ← create match, update result, match history
│   │   ├── questions.js            ← random question (correct_option_index NEVER sent to client)
│   │   ├── leaderboard.js          ← top 50 by rank, includes avatar/description per row
│   │   └── users.js                ← match history, public profile, profile edit (info/password/avatar)
│   ├── middleware/verifyToken.js   ← JWT validation middleware
│   ├── socket/gameHandler.js       ← ALL Socket.io game logic lives here
│   └── lib/supabase.js             ← Supabase service-role client
│
└── database/
    ├── schema.sql                  ← 6 tables + leaderboard trigger
    └── seed.sql                    ← 15 Python Control Flow questions
```

---

## Database Tables

All PKs are UUID (gen_random_uuid()). All FKs have ON DELETE CASCADE.

- **USERS:** user_id, username, email, password_hash, total_wins, created_at,
  profile_picture_url (VARCHAR(500), nullable), description (TEXT, default '')
- **SESSIONS:** session_id, host_user_id→USERS, session_code, qr_token,
  status ('waiting'/'active'/'ended'), created_at, ended_at
- **MATCHES:** match_id, session_id→SESSIONS, player1_id→USERS, player2_id→USERS,
  winner_id→USERS (nullable), player1_final_hp, player2_final_hp, played_at
- **QUESTIONS:** question_id, concept_type, difficulty ('easy'/'medium'/'hard'),
  code_snippet, option_1, option_2, option_3,
  correct_option_index INT (1/2/3) ← NEVER sent to frontend,
  explanation
- **MATCH_ROUNDS:** round_id, match_id→MATCHES, question_id→QUESTIONS,
  round_number, player1_key_struck, player2_key_struck,
  player1_response_ms, player2_response_ms,
  round_winner_id→USERS (nullable), damage_dealt
- **LEADERBOARD:** leaderboard_id, user_id→USERS (UNIQUE), rank, wins,
  total_matches, win_rate NUMERIC(5,2), xp, updated_at
  ← auto-updated by PostgreSQL trigger after every MATCHES insert

---

## REST API (all prefixed /api)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | /api/auth/register | — | Register user |
| POST | /api/auth/login | — | Login, sets sf_token HTTP-only cookie |
| POST | /api/auth/logout | JWT | Clear cookie |
| GET | /api/auth/me | JWT | Get current user |
| POST | /api/sessions | JWT | Create session + QR token |
| GET | /api/sessions/join/:session_code | — | Look up a session by its human-readable code (used by /home's join form). Must stay registered ABOVE /:token. |
| GET | /api/sessions/:token | — | Validate QR token |
| PATCH | /api/sessions/:id | JWT | Update session status |
| POST | /api/matches | — | Create match record |
| PATCH | /api/matches/:id | — | Update match result |
| POST | /api/matches/:id/rounds | — | Insert round record |
| GET | /api/users/:id/matches | JWT | Match history (paginated); caller must own :id (403 otherwise) |
| GET | /api/users/:id/public-profile | — | Public profile + rank/xp/win_rate for any user_id (used by /profile and UserProfileModal) |
| PATCH | /api/users/:id/profile | JWT | Update profile info, change password, OR upload avatar — one type per request, caller must own :id |
| GET | /api/questions/random | JWT | Random question (NO correct_option_index) |
| GET | /api/leaderboard | JWT | Top 50 by rank; each row now includes profile_picture_url and description |

---

## Socket.io Events (all scoped to room named by session_code)

| Event | Direction | Payload |
|-------|-----------|---------|
| session:join | Client→Server | { session_code, user_id, username, role } |
| session:player_joined | Server→Client | { user_id, username, role } |
| session:ready | Client→Server | { session_code, session_id, player1_id, player2_id } |
| round:question | Server→Client | { round_number, code_snippet, option_1/2/3, difficulty, timestamp_ms } |
| round:key_strike | Client→Server | { session_code, player, key, timestamp_ms } |
| round:result | Server→Client | { round_winner_id, correct_option_index, player1/2_answer_index, player1/2_response_ms, damage_dealt, player1/2_hp, explanation } |
| match:end | Server→Client | { winner_id, winner_username, player1_final_hp, player2_final_hp } |

---

## Critical Rules — Never Break These

- **correct_option_index NEVER leaves the server** — only used in gameHandler.js
- **Server port is 8080** — Railway's default. Do NOT change to 5000 or use process.env.PORT
- **Cookie settings:** httpOnly:true, secure: NODE_ENV==='production',
  sameSite: production?'none':'lax' (cross-domain: Vercel↔Railway)
- **CORS:** origin must be process.env.FRONTEND_URL only, credentials:true
- **Supabase:** only accessed from server/lib/supabase.js using service-role key
- **Client never talks to Supabase directly**
- **Axios interceptor:** only redirects to /login on 401 if NOT already on /login or /register
- **/join is public in middleware; /login and /register are "auth only"** (redirect to
  /home if already logged in). Everything else, including /home, is protected by default.
- **middleware.ts cannot read sf_token.** It's set cross-site by the Railway backend
  (`sameSite: none`), and Next.js middleware only sees cookies attached to requests on
  its own origin — a cross-site Set-Cookie is invisible to it. Instead, the client sets
  a same-origin, non-httpOnly marker cookie `sf_authed=1` right after a successful login
  (see login page and NavBar's logout handler, which clears it). `sf_authed` is a UI
  routing signal ONLY — never used for actual authorization. Real auth is still enforced
  exclusively by verifyToken on every API call.
- **PATCH /api/users/:id/profile is multipart-aware.** It runs `multer` (memory storage,
  2MB limit, JPEG/PNG/WEBP/GIF only) ahead of the handler; multer no-ops on non-multipart
  requests so the same route also accepts plain JSON for the info/password update types.
  Dispatch order in the handler is: `req.file` present → avatar upload; else
  `current_password`/`new_password` present → password change; else → profile info update.
- **avatars Storage bucket must be public** with an authenticated INSERT/UPDATE policy and
  a public SELECT policy, or avatar upload/display breaks even though the API call succeeds.

---

## Key Keyboard Mapping (host laptop keyboard)

```
Player 1: A=option1, S=option2, D=option3
Player 2: J=option1, K=option2, L=option3
```

All keys must be normalized with .toLowerCase() before mapping.
event.preventDefault() must be called for all 6 keys.
The listener uses a ref (matchStartedRef) so it attaches ONCE and reads
latest matchStarted value without re-attaching.

---

## Environment Variables

**Railway (server):**
- NODE_ENV=production
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- JWT_SECRET
- FRONTEND_URL=https://script-fighter-fwdd-five.vercel.app
- NIXPACKS_NODE_VERSION=22

**Vercel (client):**
- NEXT_PUBLIC_API_URL=https://script-fighter-fwdd-production.up.railway.app

---

## sessionStorage Keys (client-side game state)

- **sf_game_state** — { session_code, user_id, username, role, player1_id, player2_id }
  saved in /join before redirecting to /hud
- **sf_round_result** — full round:result payload + question fields + round_number
  saved in /hud before redirecting to /result/round
- **sf_match_result** — match:end payload
  saved in /hud before redirecting to /result/match
- **sf_redirect_after_login** — full URL to return to after login (used for QR scan flow)

---

## Known Bugs Being Debugged

_(none currently — see Fixed Bugs below)_

---

## Fixed Bugs

- **Login redirect loop (`/login?redirect=%2Flobby` stuck on login) (fixed):** middleware.ts
  was checking for `sf_token`, which it can never see (see Critical Rules above) — every
  protected route bounced straight back to /login, even immediately after a successful
  login. Fixed by introducing the `sf_authed` same-origin marker cookie.
- **Phones randomly stuck on "loading next question" (fixed):** the socket connection
  (a module-level singleton) survives navigation between /hud and /result/round, but each
  page only listens for socket events while its own component is mounted. The server
  starts the next round on a fixed 5000ms timer from when it emits round:result; the
  client's own 5s countdown on /result/round starts later (after the route transition),
  so on slower devices round:question (or match:end, emitted with no delay) could fire
  while the phone was on /result/round — which had no listener for it — and the event was
  silently dropped. Fixed by adding a safety-net listener on /result/round that stashes
  an early round:question/match:end via sessionStorage and jumps over immediately; /hud
  checks for that stashed payload on mount instead of only waiting on a live event.
- **D/L key "no answer" bug (fixed):** root cause was NOT in gameHandler.js — the
  key mapping and server-side round logic were correct all along (1-based
  option_index 1/2/3 throughout). The actual bug was in
  client/app/result/round/page.tsx's `getOptionText()`, which indexed the 0-based
  `options` array directly with the 1-based `option_index` from the server. Index 3
  (the only value D and L map to) always failed the `idx >= options.length` bounds
  check and rendered as "No answer"; indices 1 and 2 (from A/S/J/K) silently showed
  the wrong option's text instead of erroring. Fix: index with `idx - 1` and
  bounds-check against `1..options.length`.

---

## Completed Slices

- Slice 0: Scaffolding, schema.sql, seed.sql ✅
- Slice 1: Auth (register, login, logout, /me), /register and /login pages ✅
- Slice 2: Sessions, QR code, /lobby, /join ✅
- Slice 3: Socket.io rooms, session:join, player_joined ✅
- Slice 4: Game loop server-side (gameHandler.js) ✅
- Slice 5: /hud, keyboard controller in /lobby ✅
- Slice 6: /result/round, /result/match ✅
- Slice 7: /history, /leaderboard, Next.js middleware route protection ✅
- Slice 8: /home landing page, join-by-code, NavBar + UserAvatar + UserProfileModal,
  /profile (avatar upload, info edit, password change), profile_picture_url/description
  on USERS ✅ (code complete; see Remaining Work for the one manual step still needed)
- Deployment: Vercel + Railway live ✅

## Remaining Work

- Create the `avatars` Storage bucket in Supabase (public, with the INSERT/UPDATE/SELECT
  policies described in Critical Rules) — avatar upload will fail without it. Everything
  else in Slice 8 works without this step.
- Manually click through the browser-only behaviors that couldn't be verified without a
  live browser: drag-and-drop upload, mobile hamburger collapse, modal Escape/backdrop
  close, and avatar upload end-to-end once the bucket exists.
