# How to run and test the Events application

Step-by-step guide to start Postgres, the NestJS API, and the React frontend, then verify every endpoint and the full user flow.

---

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- **Docker Desktop** (for PostgreSQL)
- Optional: **Postman** or **curl** for API testing

Confirm tools:

```bash
node -v
npm -v
docker -v
```

---

## Part 1 — Start the stack

### Step 1. Open the project

```bash
cd /Users/darshan/Desktop/rescue-rituals
```

### Step 2. Start PostgreSQL

```bash
docker compose up -d
```

Check it is running:

```bash
docker compose ps
```

You should see `events-postgres` with status **Up** on port `5432`.

### Step 3. Configure backend env

```bash
cd backend
cp ../.env.example .env
```

Default `.env` values (local):

```env
DATABASE_URL="postgresql://events:events@localhost:5432/events?schema=public"
JWT_SECRET="dev-jwt-secret-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3000
```

### Step 4. Install backend deps, migrate, seed

```bash
cd backend
npm install
npx prisma migrate dev
npm run prisma:seed
```

Expected seed users:

| Email | Password |
|-------|----------|
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |

### Step 5. Start the API

```bash
cd backend
npm run start:dev
```

Leave this terminal open. You should see:

```text
API running on http://localhost:3000
Swagger docs at http://localhost:3000/api
```

Quick checks:

- Browser: [http://localhost:3000/health](http://localhost:3000/health) → `{ "status": "ok", ... }`
- Swagger UI: [http://localhost:3000/api](http://localhost:3000/api)

### Step 6. Start the frontend (new terminal)

```bash
cd /Users/darshan/Desktop/rescue-rituals/frontend
cp .env.example .env
npm install
npm run dev
```

Open: [http://localhost:5173](http://localhost:5173)  
(or [http://127.0.0.1:5173](http://127.0.0.1:5173))

---

## Part 2 — Test every API endpoint (curl)

Use a third terminal. Set a base URL:

```bash
export BASE=http://localhost:3000
```

### A. Health

```bash
curl -s "$BASE/health" | python3 -m json.tool
```

**Expect:** HTTP 200, `"status": "ok"`.

---

### B. Auth — Register

```bash
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "carol@example.com",
    "password": "password123",
    "name": "Carol Test"
  }' | python3 -m json.tool
```

**Expect:** HTTP 201, body with `access_token` and `user`.

Duplicate email:

```bash
curl -s -o /tmp/reg.json -w "HTTP %{http_code}\n" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"carol@example.com","password":"password123","name":"Carol"}'
cat /tmp/reg.json
```

**Expect:** HTTP 409 Conflict.

---

### C. Auth — Login

```bash
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}')

echo "$LOGIN" | python3 -m json.tool

export TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "TOKEN set (${#TOKEN} chars)"
```

**Expect:** HTTP 200, `access_token` present.

Bad password:

```bash
curl -s -o /tmp/bad.json -w "HTTP %{http_code}\n" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"wrongpass"}'
cat /tmp/bad.json
```

**Expect:** HTTP 401.

---

### D. Events — List (public)

```bash
curl -s "$BASE/events?page=1&limit=20" | python3 -m json.tool
```

**Expect:** HTTP 200, shape `{ "data": [...], "meta": { "total", "page", "limit" } }`.

---

### E. Events — Create (JWT required)

```bash
CREATE=$(curl -s -X POST "$BASE/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Manual Test Meetup",
    "description": "Created while following approach.md",
    "startsAt": "2026-12-15T18:00:00.000Z",
    "location": "Bangalore",
    "capacity": 2
  }')

echo "$CREATE" | python3 -m json.tool

export EVENT_ID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "EVENT_ID=$EVENT_ID"
```

**Expect:** HTTP 201, event with `ownerId`, `attendeeCount`, `spotsLeft`.

Without token:

```bash
curl -s -o /tmp/unauth.json -w "HTTP %{http_code}\n" -X POST "$BASE/events" \
  -H "Content-Type: application/json" \
  -d '{"title":"x","description":"y","startsAt":"2026-12-15T18:00:00.000Z","location":"z","capacity":1}'
cat /tmp/unauth.json
```

**Expect:** HTTP 401.

---

### F. Events — Get by id (public)

```bash
curl -s "$BASE/events/$EVENT_ID" | python3 -m json.tool
```

**Expect:** HTTP 200, includes `attendees` array and counts.

---

### G. Events — Update (owner only)

```bash
curl -s -X PATCH "$BASE/events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Manual Test Meetup (Updated)"}' | python3 -m json.tool
```

**Expect:** HTTP 200, updated title.

As non-owner (Bob):

```bash
BOB_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"password123"}')
export BOB_TOKEN=$(echo "$BOB_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /tmp/forbid.json -w "HTTP %{http_code}\n" -X PATCH "$BASE/events/$EVENT_ID" \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hack attempt"}'
cat /tmp/forbid.json
```

**Expect:** HTTP 403 Forbidden.

---

### H. RSVP — Join (JWT)

```bash
curl -s -X POST "$BASE/events/$EVENT_ID/rsvp" \
  -H "Authorization: Bearer $BOB_TOKEN" | python3 -m json.tool
```

**Expect:** HTTP 201, `attendeeCount` increased, `spotsLeft` decreased.

Duplicate RSVP:

```bash
curl -s -o /tmp/dup.json -w "HTTP %{http_code}\n" -X POST "$BASE/events/$EVENT_ID/rsvp" \
  -H "Authorization: Bearer $BOB_TOKEN"
cat /tmp/dup.json
```

**Expect:** HTTP 409 Conflict (`already RSVPed`).

Fill capacity (capacity was 2 — Alice RSVPs too):

```bash
curl -s -X POST "$BASE/events/$EVENT_ID/rsvp" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Register a third user and try to join — should fail when full:

```bash
THIRD=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"carol@example.com","password":"password123"}')
THIRD_TOKEN=$(echo "$THIRD" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -o /tmp/full.json -w "HTTP %{http_code}\n" -X POST "$BASE/events/$EVENT_ID/rsvp" \
  -H "Authorization: Bearer $THIRD_TOKEN"
cat /tmp/full.json
```

**Expect:** HTTP 400 (`Event is at full capacity`) once 2 attendees exist.

---

### I. RSVP — List attendees (public)

```bash
curl -s "$BASE/events/$EVENT_ID/attendees" | python3 -m json.tool
```

**Expect:** HTTP 200, `attendees` list with names/emails, counts matching capacity rules.

---

### J. RSVP — Cancel (JWT)

```bash
curl -s -X DELETE "$BASE/events/$EVENT_ID/rsvp" \
  -H "Authorization: Bearer $BOB_TOKEN" | python3 -m json.tool
```

**Expect:** HTTP 200, `attendeeCount` decreased, `spotsLeft` increased.

Cancel again:

```bash
curl -s -o /tmp/norsvp.json -w "HTTP %{http_code}\n" -X DELETE "$BASE/events/$EVENT_ID/rsvp" \
  -H "Authorization: Bearer $BOB_TOKEN"
cat /tmp/norsvp.json
```

**Expect:** HTTP 404.

---

### K. Events — Delete (owner only)

Non-owner:

```bash
curl -s -o /tmp/del403.json -w "HTTP %{http_code}\n" -X DELETE "$BASE/events/$EVENT_ID" \
  -H "Authorization: Bearer $BOB_TOKEN"
cat /tmp/del403.json
```

**Expect:** HTTP 403.

Owner:

```bash
curl -s -X DELETE "$BASE/events/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Expect:** HTTP 200, `{ "message": "Event deleted" }`.

Confirm gone:

```bash
curl -s -o /tmp/gone.json -w "HTTP %{http_code}\n" "$BASE/events/$EVENT_ID"
cat /tmp/gone.json
```

**Expect:** HTTP 404.

---

## Part 3 — Test via Swagger UI

1. Open [http://localhost:3000/api](http://localhost:3000/api).
2. Call **POST `/auth/login`** with Alice’s credentials.
3. Copy `access_token`.
4. Click **Authorize**, paste: `Bearer <token>` (or just the token if the UI adds Bearer).
5. Try protected routes: **POST `/events`**, **POST `/events/{id}/rsvp`**, **PATCH**, **DELETE**.
6. Try public routes without auth: **GET `/events`**, **GET `/events/{id}`**, **GET `/events/{id}/attendees`**.

---

## Part 4 — Test via Postman

1. Import [`docs/Events-API.postman_collection.json`](docs/Events-API.postman_collection.json).
2. Collection variable `baseUrl` = `http://localhost:3000`.
3. Run **Auth → Login** (saves `token` automatically).
4. Run **Events → Create event** (saves `eventId`).
5. Run **RSVP → Join**, **List attendees**, **Cancel**.
6. Run **Events → Update** / **Delete** as needed.

---

## Part 5 — End-to-end UI test (frontend)

With API + frontend both running:

### 1. Browse (logged out)

1. Open [http://localhost:5173](http://localhost:5173).
2. Confirm seeded events appear (e.g. Product Launch Meetup).
3. Open an event — details and attendees load without login.

### 2. Sign in as Alice (owner)

1. **Sign in** → `alice@example.com` / `password123`.
2. Header shows Alice’s name.
3. Click **Create event**, fill the form, submit.
4. Land on the new event detail page.

### 3. Edit / delete as owner

1. On Alice’s event, click **Edit**, change title, save.
2. Confirm updated title on the detail page.
3. (Optional) **Delete** and confirm redirect to the list.

### 4. RSVP as Bob

1. **Sign out**, then sign in as `bob@example.com` / `password123`.
2. Open Alice’s event.
3. Click **RSVP** — attendee count increases; Bob appears in attendees.
4. Click **Cancel RSVP** — count decreases; Bob removed.
5. RSVP again, then sign in as Alice and confirm Bob still listed (until cancel).

### 5. Auth gating

1. Sign out.
2. Try **Create** from the nav — you should be sent to login.
3. After login, create works again.

---

## Part 6 — Endpoint checklist

Use this table while testing. Mark each row when done.

| # | Method | Path | Auth | Happy path | Negative case |
|---|--------|------|------|------------|---------------|
| 1 | GET | `/health` | No | 200 ok | — |
| 2 | POST | `/auth/register` | No | 201 + token | 409 duplicate email |
| 3 | POST | `/auth/login` | No | 200 + token | 401 bad password |
| 4 | GET | `/events` | No | 200 list + meta | — |
| 5 | POST | `/events` | JWT | 201 created | 401 without token |
| 6 | GET | `/events/:id` | No | 200 + attendees | 404 unknown id |
| 7 | PATCH | `/events/:id` | JWT + owner | 200 updated | 403 non-owner |
| 8 | DELETE | `/events/:id` | JWT + owner | 200 deleted | 403 non-owner |
| 9 | POST | `/events/:id/rsvp` | JWT | 201 joined | 409 duplicate / 400 full |
| 10 | GET | `/events/:id/attendees` | No | 200 list | 404 unknown event |
| 11 | DELETE | `/events/:id/rsvp` | JWT | 200 cancelled | 404 if not RSVPed |

---

## Part 7 — Common failures

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on port 5432 | `docker compose up -d` |
| Prisma migrate errors | Confirm `DATABASE_URL` in `backend/.env` |
| API won’t start / port in use | Another process on 3000 — stop it or change `PORT` |
| Frontend can’t load events | API must be on 3000; check `frontend/.env` → `VITE_API_URL=http://localhost:3000` |
| 401 on every protected call | Missing/expired token; login again and send `Authorization: Bearer …` |
| CORS errors in browser | API enables CORS; restart `npm run start:dev` if you changed `main.ts` |

---

## Part 8 — Stop everything

```bash
# Stop frontend: Ctrl+C in its terminal
# Stop API: Ctrl+C in its terminal

# Stop Postgres (optional — data kept in volume)
cd /Users/darshan/Desktop/rescue-rituals
docker compose down

# Stop Postgres and delete DB data
docker compose down -v
```

---

## Suggested order (fast path)

1. `docker compose up -d`
2. Backend migrate + seed + `start:dev`
3. Hit `/health` and open Swagger
4. curl: login → create event → RSVP as Bob → list attendees → cancel → delete
5. Start frontend and repeat the same flow in the UI

That covers the full application from infrastructure to every endpoint and the browser experience.
