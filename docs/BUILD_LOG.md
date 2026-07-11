# Build Log: Incident Management Dashboard

This document walks through how the system was built, in the order it was
built, and explains the reasoning behind the non-obvious decisions. It's
meant to be read alongside the source — each section names the files it
produced.

---

## 1. Modeling the incident lifecycle as a state machine

**Files:** `backend/src/common/enums/incident.enum.ts`,
`backend/src/incidents/incident-state-machine.ts`,
`backend/src/database/migrations/1700000002000-InitIncidents.ts`

Before writing any CRUD code, the lifecycle itself was modeled:

```
open → investigating → identified → monitoring → resolved → postmortem
```

with the ability to step *back* one stage (e.g. `identified` →
`investigating` if new information reopens a question) but never to skip
stages or leave `postmortem` (a terminal state — reopening a written-up
incident should be a new incident, not a status flip).

This was implemented at two layers on purpose:

1. **Postgres enum + `CHECK`-equivalent type constraint** guarantees the
   `status` column can never hold a value outside the six defined states,
   even if application code has a bug. This is a data-integrity guarantee.
2. **`IncidentStateMachine` class** (a small, dependency-free class with a
   static transition map) enforces the *order* of transitions — Postgres
   alone can't express "resolved can only follow monitoring." Keeping this
   as an explicit map rather than inline `if` statements in the service
   means the API, and any future automation, read from one source of truth.

**Decision:** the state machine is a plain class, not a NestJS injectable.
It has no dependencies and no side effects — it just validates — so there
was no reason to route it through DI.

---

## 2. RBAC on top of NestJS guards

**Files:** `backend/src/common/enums/roles.enum.ts`,
`backend/src/auth/guards/roles.guard.ts`,
`backend/src/auth/guards/jwt-auth.guard.ts`,
`backend/src/auth/decorators/{roles,public,current-user}.decorator.ts`

Four roles were chosen deliberately — `admin`, `on_call_engineer`,
`responder`, `viewer` — over a fine-grained permissions matrix. For a
team-sized incident tool, four roles cover the real access patterns
without the complexity of a `Permission[]` model. If the app outgrows this,
the migration path is to replace the enum with a permissions table; the
`RolesGuard` interface wouldn't need to change shape.

Two guards, run in sequence (`@UseGuards(JwtAuthGuard, RolesGuard)`):

- `JwtAuthGuard` is registered **globally** (`APP_GUARD` in `AppModule`),
  making the API secure-by-default. Routes that must be reachable without a
  token (`/auth/login`, `/auth/register`) opt out explicitly with a
  `@Public()` decorator, rather than every other controller having to
  remember to opt in to auth.
- `RolesGuard` reads `@Roles(...)` metadata off the route. If a route has
  no `@Roles()` at all, it's authenticated-but-unrestricted — most GETs
  fall here. Mutating, severity-relevant actions (`PATCH /incidents/:id/severity`,
  `PATCH /incidents/:id/status`) require `on_call_engineer` or `admin`.

**A key nuance:** resolving an incident (`status → resolved`) requires being
either the *assigned owner* or an admin — not just any on-call engineer.
That's an instance-level check (`IncidentsService.assertCanClose`), which a
static `@Roles()` decorator can't express, since it depends on data (who
owns *this* incident), not just the caller's role. This lives in the
controller/service layer instead of being forced into the guard.

Self-registration (`POST /auth/register`) never accepts a `role` field —
the DTO doesn't have one — so a new account always lands as `viewer`.
Granting `on_call_engineer` or `admin` is a separate, explicit admin action
(`PATCH /users/:id/role`, itself `@Roles(Role.ADMIN)`-gated and audit
logged).

---

## 3. Real-time status updates

**Files:** `backend/src/websocket/incidents.gateway.ts`,
`backend/src/websocket/websocket.module.ts`,
`frontend/src/hooks/useIncidentSocket.ts`

A Socket.IO gateway with one room per incident (`incident:<id>`), plus a
global broadcast for incident creation (so the dashboard list view updates
live when a new SEV1 comes in without every client needing to join every
room).

Two decisions kept this simple and safe:

- **Server-authoritative, push-only.** Clients never write state over the
  socket — they only receive `incident:updated` and `incident:event`
  pushes. Every mutation still goes through the normal guarded REST
  endpoints; the socket is purely a notification channel. This means RBAC
  enforcement lives in exactly one place (the HTTP guards), not duplicated
  for a websocket message handler.
- **Authenticated handshake.** The socket connects with the same
  short-lived JWT used for REST calls (`client.handshake.auth.token`), and
  `handleConnection` verifies it and disconnects unauthenticated sockets.
  An unauthenticated client can't join a room and eavesdrop on incident
  traffic.

`IncidentsService` and `AttachmentsService` call `gateway.emitIncidentUpdated`
/ `emitNewEvent` only **after** a write has been persisted — never before —
so a socket subscriber never sees a state that didn't actually commit.

---

## 4. File uploads wired into the timeline

**Files:** `backend/src/attachments/*`,
`backend/src/events/entities/incident-event.entity.ts`

Attachments (logs, screenshots) are handled with Multer:

- **MIME allow-list** — images, plain text, CSV, JSON, PDF, and zip (for
  bundled log exports). No executables, no arbitrary binaries. This is an
  incident timeline, not a general file store.
- **25 MB size limit** enforced by Multer before the file is fully read.
- **Randomized storage filenames** (`randomUUID() + extname(original)`) —
  the *original* filename is kept only as metadata in Postgres, never used
  to construct a filesystem path. This is what prevents path traversal
  (`../../etc/passwd`) and collisions from user-controlled input.
- **Uploading is itself a timeline event.** `AttachmentsService.saveMetadata`
  writes an `IncidentEvent` of type `attachment_added` in the same
  operation, so evidence shows up in the incident's chronological story
  exactly where it happened, not as a side list disconnected from the
  narrative.

Downloads stream the file back with the *original* filename in the
`Content-Disposition` header, so the UUID-on-disk is invisible to the user.

---

## 5. Filtering, full-text search, audit logs

**Files:** `backend/src/incidents/incidents.service.ts` (`findAll`),
`backend/src/database/migrations/1700000002000-InitIncidents.ts`,
`backend/src/audit/*`

**Search** uses Postgres full-text search rather than `ILIKE '%term%'`:

- A `search_vector tsvector` column on `incidents`, maintained by a
  `BEFORE INSERT OR UPDATE` trigger (`incidents_search_vector_update`) —
  not recomputed in application code — so it stays correct even for rows
  changed by a future backfill or raw SQL migration.
- Title is weighted `'A'` and description `'B'`, so title matches rank
  above body matches in relevance-ordered results.
- A `GIN` index on `search_vector` makes `@@ plainto_tsquery(...)` an index
  scan instead of a sequential scan once the incidents table has real
  history — the whole point of "past incidents are actually useful during
  the next one" is that search has to stay fast as the table grows.

**Filtering + pagination** (status, severity, owner) are applied on the
same query builder as search, and a composite index on
`(status, severity)` backs the most common dashboard view ("open incidents
by severity").

**Audit logs** are deliberately a separate concept from the incident
timeline, even though they overlap in content:

| | `IncidentEvent` | `AuditLog` |
|---|---|---|
| Answers | "What happened to this incident?" | "Who did what in the system?" |
| Read by | A responder working the incident | An admin doing a security review |
| Scoped to | One incident | Every mutating action, system-wide |
| Survives incident deletion | No (cascades) | Yes (no FK, denormalized) |

Every mutating action (`incident.created`, `incident.status_changed`,
`incident.severity_changed`, `incident.owner_assigned`,
`incident.attachment_uploaded`, `user.role_changed`, `auth.login_failed`,
`auth.login_succeeded`) writes an `AuditLog` row with actor, action, entity,
and JSON metadata. `AuditService.record` is `await`-ed rather than
fire-and-forget — a silently-failing audit write is worse than a slightly
slower request; if this needs to become async later, that should be an
explicit decision (e.g. an outbox table), not a forgotten `.catch(() => {})`.

---

## 6. Containerization and CI

**Files:** `backend/Dockerfile`, `frontend/Dockerfile`,
`frontend/nginx.conf`, `docker-compose.yml`,
`.github/workflows/ci.yml`

Both Dockerfiles are multi-stage:

- **Backend:** a `build` stage runs `npm ci` + `nest build` with full
  devDependencies; the `production` stage does a clean `npm ci --omit=dev`
  and copies only `dist/` across. DevDependencies (Nest CLI, TypeScript,
  test tooling) never end up in the shipped image.
- **Frontend:** a `build` stage runs `vite build`; the `production` stage
  serves the static output through **nginx**, not `vite preview` — Vite's
  preview server isn't intended for production traffic. `nginx.conf`
  includes an SPA fallback (`try_files ... /index.html`) so client-side
  routes like `/incidents/:id` survive a hard refresh.

`docker-compose.yml` wires Postgres, the backend, and the frontend
together, with:

- A Postgres **healthcheck** (`pg_isready`) that the backend's
  `depends_on: condition: service_healthy` waits on, so the backend
  doesn't start attempting connections before Postgres is actually ready.
- A **named volume** for uploads (`backend_uploads`), not a bind mount —
  evidence attachments persist across container recreation without
  depending on the host's filesystem layout.
- `JWT_SECRET:?JWT_SECRET must be set` — compose refuses to start rather
  than silently booting with an empty secret.

**CI** (`.github/workflows/ci.yml`) runs on every PR and push to `main`,
as three jobs:

1. **Backend** — lint, unit tests (against a real Postgres service
   container, so the state-machine and RBAC-guard tests run against the
   same engine as production), and a build.
2. **Frontend** — lint and a full TypeScript build (`tsc -b && vite
   build`), which catches type errors across the whole app, not just
   changed files.
3. **Docker build check** — builds both production Docker images (without
   pushing them anywhere) so a broken `Dockerfile` fails CI instead of
   surfacing only at deploy time.

---

## Design decisions not covered above

- **Password hashes are `select: false`** on the `User` entity, so no
  ordinary repository query can accidentally leak a hash into an API
  response (e.g. `GET /incidents` → `reporter` → hash). The one path that
  needs it (`AuthService.login`) explicitly opts in with
  `.addSelect('user.passwordHash')`.
- **JWTs are short-lived (15 minutes).** `JwtStrategy.validate` trusts the
  role embedded in the token without a fresh DB lookup on every request —
  that's a deliberate latency/staleness tradeoff, and the short TTL is what
  bounds how long a just-revoked or just-downgraded role stays valid.
- **Same error message for "no such user" and "wrong password"** on login,
  to avoid leaking which email addresses have accounts (user enumeration).
- **`ValidationPipe` uses `whitelist: true, forbidNonWhitelisted: true`.**
  Any request property not declared on the DTO is rejected outright, not
  silently dropped — this is what stops a client from slipping an
  unexpected field (like a `role` on registration) into a payload and
  having the server process something it shouldn't.
- **A single global `AllExceptionsFilter`** normalizes every error response
  (validation failures, guard rejections, unexpected exceptions) to one
  shape, so the frontend can handle errors generically. Unexpected (non-
  `HttpException`) errors are logged with full detail server-side but
  return a generic message to the client.

---

## What's intentionally out of scope

This is a demonstration project, not a production deployment. Known gaps,
left as an exercise or a "next step" rather than built out:

- No password reset / email verification flow.
- No refresh tokens — expired access tokens require a fresh login (15 min
  window). A refresh-token rotation scheme would be the natural next step
  for a real deployment.
- File storage is local disk (`UPLOAD_DIR`), not S3/GCS — fine for a single
  container with a persistent volume, not for horizontal scaling of the
  backend.
- No rate limiting tuned specifically for `/auth/login` beyond the global
  throttle — a real deployment would want a tighter, IP+email-keyed limit
  there specifically.
