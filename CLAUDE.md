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
  react-hook-form, Zod, react-qr-code
- **Backend:** Node.js + Express, Socket.io, bcrypt, jsonwebtoken, express-validator,
  @supabase/supabase-js, qrcode, uuid, cookie-parser
- **Database:** Supabase (PostgreSQL) — accessed ONLY from server, never from client
- **Deployment:** Frontend → Vercel | Backend → Railway (port 8080) | DB → Supabase

---

## Monorepo Structure

```
script-fighter/
├── client/          ← Next.js frontend (deployed to Vercel)
│   ├── app/
│   │   ├── (auth)/register/page.tsx
│   │   ├── (auth)/login/page.tsx
│   │   ├── lobby/page.tsx          ← host screen, keyboard listener lives here
│   │   ├── join/page.tsx           ← QR landing page
│   │   ├── hud/page.tsx            ← player mobile game screen
│   │   ├── result/round/page.tsx   ← post-round feedback
│   │   ├── result/match/page.tsx   ← match end summary
│   │   ├── history/page.tsx
│   │   └── leaderboard/page.tsx
│   ├── lib/
│   │   ├── axios.ts                ← singleton Axios instance, baseURL from env
│   │   └── socket.ts               ← singleton Socket.io client
│   ├── hooks/useSocket.ts
│   └── middleware.ts               ← route protection (JWT cookie check)
│
├── server/          ← Node.js + Express + Socket.io (deployed to Railway)
│   ├── index.js                    ← listens on port 8080 (Railway default)
│   ├── routes/
│   │   ├── auth.js                 ← register, login, logout, /me
│   │   ├── sessions.js             ← create session, validate QR token
│   │   ├── matches.js              ← create match, update result, match history
│   │   ├── questions.js            ← random question (correct_option_index NEVER sent to client)
│   │   └── leaderboard.js
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

- **USERS:** user_id, username, email, password_hash, total_wins, created_at
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
| GET | /api/sessions/:token | — | Validate QR token |
| PATCH | /api/sessions/:id | JWT | Update session status |
| POST | /api/matches | — | Create match record |
| PATCH | /api/matches/:id | — | Update match result |
| POST | /api/matches/:id/rounds | — | Insert round record |
| GET | /api/users/:id/matches | JWT | Match history (paginated) |
| GET | /api/questions/random | JWT | Random question (NO correct_option_index) |
| GET | /api/leaderboard | JWT | Top 50 by XP |
| GET | /api/users/:id/profile | JWT | User profile + rank |

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
- **/join and /login are NOT in the protected middleware routes**

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
- Deployment: Vercel + Railway live ✅

## Remaining Work

- Slice 7: /history, /leaderboard, Next.js middleware route protection
