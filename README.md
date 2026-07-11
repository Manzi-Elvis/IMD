# Incident Management Dashboard

Report, triage, and resolve production software incidents end to end —
severity classification, ownership, real-time timelines, evidence uploads,
and audit history.

## Stack

| Layer          | Technology                                   |
|----------------|-----------------------------------------------|
| Frontend       | React + TypeScript + Tailwind CSS + Vite      |
| Backend        | NestJS + TypeORM                              |
| Database       | PostgreSQL (full-text search, triggers)       |
| Real-time      | Socket.IO (WebSocket gateway)                 |
| Infrastructure | Docker, Docker Compose, GitHub Actions        |

## What it demonstrates

- **RBAC** — 4 roles (`admin`, `on_call_engineer`, `responder`, `viewer`) enforced by NestJS guards, plus instance-level ownership checks (only an incident's owner or an admin can resolve it).
- **Authentication** — JWT (short-lived, 15m), bcrypt password hashing, a global auth guard that's secure-by-default with explicit `@Public()` opt-outs.
- **File uploads** — Multer with MIME allow-listing, size limits, and randomized storage filenames (no path traversal from user input).
- **Real-time updates** — Socket.IO rooms per incident; authenticated handshake; server-authoritative (sockets only push, all writes go through guarded REST endpoints).
- **Pagination, filtering, search** — Postgres full-text search (`tsvector` + GIN index + a maintain trigger), combined with status/severity/owner filters and page/limit pagination in one query.
- **Audit logs** — every mutating action recorded with actor, action, entity, metadata, separate from the incident timeline.
- **Clean architecture** — feature modules (auth, users, incidents, events, attachments, audit, websocket), a domain-level state machine class instead of scattered `if` statements, DTfeatured validation, global exception filter.

## Project layout

```
incident-management-dashboard/
├── backend/                # NestJS API
│   ├── src/
│   │   ├── auth/           # JWT strategy, guards, decorators
│   │   ├── users/          # User entity, roles
│   │   ├── incidents/      # Core domain: entity, service, controller, state machine
│   │   ├── events/         # Incident timeline entries
│   │   ├── attachments/    # File upload handling
│   │   ├── audit/          # Audit log entity/service/controller
│   │   ├── websocket/      # Socket.IO gateway
│   │   ├── common/         # Enums, filters, interceptors shared across modules
│   │   └── database/migrations/
│   └── test/                # Unit tests
├── frontend/                # React SPA
│   └── src/
│       ├── api/             # Axios client + typed endpoint wrappers
│       ├── components/      # Reusable UI (badges, nav, modal, protected route)
│       ├── context/         # Auth context
│       ├── hooks/           # useIncidentSocket
│       ├── pages/           # Route-level pages
│       └── types/           # Shared domain types (mirrors backend enums)
├── docs/                    # Build documentation
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Running locally with Docker (recommended)

```bash
cp backend/.env.example backend/.env      # edit JWT_SECRET, DB credentials
export JWT_SECRET=$(openssl rand -hex 64)  # or edit backend/.env directly

docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- Postgres: localhost:5432

Then run migrations once the containers are up:

```bash
docker compose exec backend npm run migration:run
```

## Running locally without Docker

**Prerequisites:** Node.js 20+, PostgreSQL 16+ running locally.

### Backend

```bash
cd backend
cp .env.example .env    # set DB_* vars and JWT_SECRET
npm install
npm run migration:run
npm run start:dev       # http://localhost:3000
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

### Creating your first admin

Registration always creates a `viewer` (see `docs/BUILD_LOG.md` for why).
Promote the first user to admin directly in Postgres:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

From there, use `PATCH /api/users/:id/role` (admin-only) to promote others.

## Note on lockfiles

`package-lock.json` files aren't included in this scaffold (they weren't
generated in the environment this was built in). Run `npm install` once in
both `backend/` and `frontend/` locally — that creates the lockfile — and
commit it. CI and the Dockerfiles both use `npm ci`, which requires a
committed lockfile to be reproducible.

## Tests

```bash
cd backend && npm run test        # unit tests: state machine, RBAC guard
cd frontend && npm run build      # type-checks the whole app
```

## Documentation

See [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) for a detailed walkthrough of
how the system was built, the reasoning behind each major decision, and the
tradeoffs considered along the way.
