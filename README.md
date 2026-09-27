# Events Management API

NestJS + PostgreSQL backend with JWT auth, event CRUD, RSVP/attendee tracking, Swagger docs, and a React frontend.

## Quick start

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
# → http://localhost:3000
# → Swagger http://localhost:3000/api

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Or from the repo root after `npm install` in each package:

```bash
npm run db:up
npm run backend:dev    # terminal 1
npm run frontend:dev   # terminal 2
```

## Demo users

| Email | Password |
|-------|----------|
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |

## Data model

| Table | Purpose |
|-------|---------|
| `User` | Accounts (`email`, `passwordHash`, `name`) |
| `Event` | Events owned by a user (`title`, `description`, `startsAt`, `location`, `capacity`) |
| `Rsvp` | Join records — unique `(userId, eventId)` |

RSVP joins run in a transaction with `SELECT … FOR UPDATE` on the event row so concurrent RSVPs cannot overbook capacity. Duplicate RSVPs return `409 Conflict`.

## API

### Auth
| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | Public |
| POST | `/auth/login` | Public |

### Events
| Method | Path | Auth |
|--------|------|------|
| POST | `/events` | JWT |
| GET | `/events` | Public |
| GET | `/events/:id` | Public |
| PATCH | `/events/:id` | JWT + owner |
| DELETE | `/events/:id` | JWT + owner |

### RSVP
| Method | Path | Auth |
|--------|------|------|
| POST | `/events/:id/rsvp` | JWT |
| DELETE | `/events/:id/rsvp` | JWT |
| GET | `/events/:id/attendees` | Public |

### Health
| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | Public |

## Docs

- Swagger UI: `/api`
- Postman collection: [docs/Events-API.postman_collection.json](docs/Events-API.postman_collection.json)
- Submission checklist + interview drafts: [SUBMISSION.md](SUBMISSION.md)

## Design notes

- Only authenticated users can create events; only the owner can update or delete.
- List/detail responses include `attendeeCount` and `spotsLeft`.
- Capacity cannot be lowered below the current attendee count.
- JWT via `Authorization: Bearer <token>`.

## Project layout

```
/
├── docker-compose.yml
├── docs/Events-API.postman_collection.json
├── backend/          # NestJS + Prisma
└── frontend/         # Vite + React
```

## API Documentation

Swagger UI is available at:

/api