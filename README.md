# AI Scholarship Copilot

A full-stack AI-powered scholarship discovery, eligibility analysis, document assistance and application-tracking platform.

Automation runs **in-process** — there is no external workflow engine to install or operate.

---

## Technology Stack

* **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Lucide icons
* **Backend** — Node.js, Express, TypeScript, Zod validation, centralised error handling, structured logging
* **Database** — Prisma ORM with SQLite (default) or PostgreSQL, versioned migrations
* **Auth** — JWT bearer tokens, bcrypt password hashing, role-based authorization (`STUDENT` / `ADMIN`)
* **Automation** — in-app scheduler + workflow runner with retries, idempotency keys and a durable run ledger
* **AI** — OpenAI function calling with a deterministic fallback engine for every feature

---

## Repository Structure

```
ai-final/
├── backend/
│   ├── prisma/
│   │   ├── migrations/          versioned SQL migrations
│   │   └── schema.prisma
│   ├── src/
│   │   ├── agents/              chat orchestrator (tool calling)
│   │   ├── automation/          workflow registry, runner, scheduler
│   │   ├── config/              env loading + production guards
│   │   ├── controllers/
│   │   ├── middleware/          auth, validation, rate limits, security headers
│   │   ├── prisma/seed.ts
│   │   ├── routes/
│   │   ├── scripts/             operational scripts
│   │   ├── services/
│   │   ├── tests/               journey + unit suites
│   │   ├── tools/               chatbot tool definitions
│   │   ├── utils/
│   │   └── validators/          Zod schemas
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/          common/, layout/, chat/, scholarships/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/api.ts
│   │   └── types/
│   └── .env.example
├── .env.example                 full variable reference
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env            # then edit JWT_SECRET and ADMIN_EMAILS

npm run prisma:generate
npm run prisma:deploy           # apply migrations (use in all environments)
npm run prisma:seed             # demo scholarships + demo users

npm run dev                     # http://localhost:5000
# production:
npm run build && npm start
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
# production:
npm run build                   # emits dist/
```

The Vite dev server proxies `/api` to `localhost:5000`, so no frontend env file is needed for local development.

---

## Credentials & Health Checks

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness — touches no dependencies |
| `GET /api/health/ready` | Readiness — verifies database connectivity |

Seeded accounts (password `Password123!` for both):

| Email | Role | Access |
| --- | --- | --- |
| `student@example.com` | `STUDENT` | Full student experience |
| `admin@example.com` | `ADMIN` | Adds catalogue writes, verification queue, automation console |

Admin rights are granted by JWT role **or** by listing the email in `ADMIN_EMAILS`.

---

## Automation

Ten workflows run in-process on intervals. No external engine required.

| Workflow key | Cadence | Purpose |
| --- | --- | --- |
| `scholarship-discovery` | 24 h | Ingest + deduplicate scholarship records |
| `scholarship-verification` | 6 h | Field-level verification audit |
| `scholarship-update-monitoring` | 12 h | Demote past-deadline records to `EXPIRED` |
| `personalized-matching` | 12 h | Recalculate compatibility scores |
| `new-match-notification` | 6 h | Alert students to new high-scoring matches |
| `deadline-reminder` | 24 h | Milestone reminders at 30/14/7/3/1 days |
| `application-reminder` | 24 h | Nudge incomplete checklists |
| `notification-dispatch` | 15 min | Claim notifications for outbound delivery |
| `automation-health-audit` | 1 h | Summarise failures, reap abandoned runs |
| `cv-processing` | manual | Analyse a supplied CV (requires payload) |

**Admin console:** `/automation` — live status, manual triggers, run history with metrics and errors.

**API:**

```
GET  /api/automation/workflows          catalogue + last run per workflow
GET  /api/automation/stats              24-hour health summary
GET  /api/automation/runs               paginated execution ledger
POST /api/automation/workflows/:key/run manual trigger
```

Every run writes a `WorkflowRun` row: status, attempt count, duration, metrics, error. Overlap is prevented by a unique `lockKey`; duplicate side effects are prevented by `Notification.dedupeKey`.

Set `AUTOMATION_ENABLED=false` to run an API replica without the scheduler.

---

## Testing

```bash
cd backend
npm run typecheck              # no-emit type check
npm run test:journeys          # 93 assertions across the 4 user journeys
npm run check:duplicates       # pre-migration uniqueness check
```

`test:journeys` covers registration → profile → recommendations → eligibility → save; chatbot search → compare → save → application; tracker → checklist → deadline → notification; and discovery → verification → matching → notification. It also asserts cross-user isolation, authorization boundaries, validation and idempotency. The suite creates and removes its own data.

---

## Configuration

See [`.env.example`](./.env.example) for the annotated reference. Required in production:

| Variable | Notes |
| --- | --- |
| `NODE_ENV=production` | Enables production guards |
| `JWT_SECRET` | ≥ 32 characters — **the server refuses to boot without it** |
| `DATABASE_URL` | Required; no fallback in production |
| `ADMIN_EMAILS` | Without it, no account can reach admin routes |
| `FRONTEND_URL` / `CORS_ORIGINS` | CORS allowlist |

`OPENAI_API_KEY` is optional — every AI feature has a deterministic fallback, so the platform is fully functional without it.

---

## PostgreSQL

1. Set `provider = "postgresql"` in `backend/prisma/schema.prisma`.
2. Point `DATABASE_URL` at the cluster.
3. Delete `backend/prisma/migrations/` and run `npx prisma migrate dev --name init` to generate Postgres-dialect migrations (the committed SQL is SQLite-specific).

Note that Prisma's `contains` filter is case-insensitive on SQLite but **case-sensitive** on PostgreSQL, so scholarship search becomes case-sensitive unless the queries are switched to `mode: 'insensitive'`.
