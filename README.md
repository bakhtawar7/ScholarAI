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
npm run lint                   # ESLint (0 errors enforced)
npm run test                   # all offline suites (alias: test:all)
npm run test -- --include-network   # also the live-search suite
npm run check:duplicates       # pre-migration uniqueness check
npm run check:email            # what the email transport will actually do
```

`npm test` runs all nine suites via `src/tests/runAll.ts`. Each run copies the database to
a scratch file and points `DATABASE_URL` at the copy, so a suite that crashes mid-run cannot
leave orphaned rows in the database you are developing against. Outbound email is disabled
for the run — the suites previously made live Resend API calls with `@example.com`
recipients on every execution.

Individual suites: `test:auth`, `test:explorer`, `test:matching`, `test:applications`,
`test:verification`, `test:documents`, `test:chatbot`, `test:journeys`, `test:discovery`.
Filter with `npm test -- --only matching`; keep the scratch database with `--keep-db`.

`test:journeys` covers registration → profile → recommendations → eligibility → save;
chatbot search → compare → save → application; tracker → checklist → deadline →
notification; and discovery → verification → matching → notification. It also asserts
cross-user isolation, authorization boundaries, validation and idempotency.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check, migrations, seed and the
offline suites for both packages on Linux — which is also what keeps the npm scripts
cross-platform.

---

## Where scholarship results come from

Two distinct paths, which is worth knowing before judging what the app is showing you.

| Path | Source |
| --- | --- |
| `GET /api/scholarships` — the explorer's search and filters | **Database only.** No network call exists here. |
| `GET /api/scholarships/for-me` — the scholarships page default | **Database only**, grouped and ranked against the profile |
| Chatbot `discoverScholarships` (its primary tool) | **Live web search**, then persisted |
| Chatbot `searchScholarships` | Database only, by design |
| `scholarship-discovery` workflow (24 h) | Live search → ingested |
| `POST /api/scholarships/discover/country` | Live search scoped to one country, on demand |

So browsing is a catalogue view; live discovery happens through the assistant, the nightly
workflow, or an explicit country search. Everything discovered is written to the database,
which is why `scholarshipDiscoveryService` calls it "a cache and persistence layer, not the
source of results".

**Live search needs a provider.** With `SCHOLARSHIP_SEARCH_PROVIDER=gemini` it uses Google
Search grounding through the existing LLM key — no extra signup, but it shares that key's
quota, so an exhausted Gemini quota takes out AI *and* search together. Setting
`SCHOLARSHIP_SEARCH_API_KEY` with `serper`, `tavily` or `brave` keeps them independent. A
keyless DuckDuckGo fallback is tried last. Run `npm run probe:search` to see the resolved
chain and whether an outbound search actually happened.

When every provider fails, discovery falls back to the catalogue and **says so** — each
result carries `resultSource: 'LIVE_EXTERNAL' | 'KNOWLEDGE_BASE'`, the tool reports
`usedLiveExternalSearch: false`, and a notice is added. Cached rows are never presented as
fresh findings.

---

## The scholarships page

Signed in and unfiltered, the page shows three disjoint sections, each ranked by match score:

| Section | Contents |
| --- | --- |
| **In {home country}** | Hosted in the student's `countryOfResidence` |
| **In your target countries** | Hosted in their `targetCountries` (home country excluded, so nothing appears twice) |
| **Elsewhere in the world** | Strong matches outside both |

A section is omitted rather than shown empty when the profile lacks that field, and
`notices` says what to fill in. Searching or filtering switches to the flat paginated list —
grouping by country stops meaning anything once a country filter is applied.

The seeded catalogue is entirely study-abroad destinations, so the home section usually
starts empty: there are 21 records across Germany, the US, the UK and others, and none in
(for example) Pakistan. That is what `discoverable: true` is for — the section offers a
one-click live search for that country rather than implying no such scholarships exist.
`POST /api/scholarships/discover/country` is limited to 4 calls per 10 minutes per account,
because each one spends a real search quota.

---

## Authentication

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create an account |
| `POST /api/auth/login` | Sign in |
| `GET /api/auth/me` | Current account, profile, and computed `isAdmin` |
| `POST /api/auth/forgot-password` | Email a single-use reset link |
| `POST /api/auth/reset-password` | Consume the link and set a new password |
| `POST /api/auth/change-password` | Change password (requires the current one) |
| `POST /api/auth/logout-all` | Revoke every session for the account |

Tokens are 7-day JWTs. `User.passwordChangedAt` is the revocation point: the auth middleware
rejects any token issued before it, so a password change, a reset, or `logout-all` genuinely
ends existing sessions rather than leaving them valid until expiry. With
`AUTH_STRICT_SESSION_CHECK` on (the default) the account is re-read per request, so deleted
accounts and role changes also take effect immediately instead of after up to a week.

Reset tokens are stored only as SHA-256 hashes — the plaintext exists solely in the email —
and are single-use. `forgot-password` always answers `200` with the same body whether or not
the address is registered, so it cannot be used to enumerate accounts.

Clients must read `isAdmin` from `/api/auth/me` rather than comparing `role`: admin can also
be granted through `ADMIN_EMAILS`, which the role field does not reflect.

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

### Email

`RESEND_FROM_EMAIL` is the setting most likely to be wrong. Resend only sends from a domain
you have proven you own via DNS, so a consumer address — `gmail.com`, `outlook.com`,
`yahoo.com` — can never work: every send is rejected with
`403 The gmail.com domain is not verified`. Because sends are fire-and-forget, that failure
is invisible in normal use.

| Situation | `RESEND_FROM_EMAIL` |
| --- | --- |
| No domain yet (development, demo) | `onboarding@resend.dev` — works with no DNS setup, but delivers **only** to your own Resend account address |
| Production | An address on a domain verified at [resend.com/domains](https://resend.com/domains) |

The server refuses to treat an unusable sender as configured, warns about it at boot, and
distinguishes a permanent configuration fault from a provider outage in the logs. Run
`npm run check:email` to see what your configuration will actually do, or
`npm run check:email -- you@example.com` to attempt a real send.

---

## PostgreSQL

1. Set `provider = "postgresql"` in `backend/prisma/schema.prisma`.
2. Point `DATABASE_URL` at the cluster.
3. Delete `backend/prisma/migrations/` and run `npx prisma migrate dev --name init` to generate Postgres-dialect migrations (the committed SQL is SQLite-specific).

Case sensitivity is already handled. Prisma compiles `contains` to `LIKE`, which is
case-insensitive on SQLite but case-sensitive on PostgreSQL — so search would have silently
become case-sensitive on migration. `backend/src/utils/prismaFilters.ts` detects the
connector from `DATABASE_URL` and applies `mode: 'insensitive'` only where it is valid (the
SQLite connector rejects the argument outright, so it cannot simply be added everywhere).

That module also fixes element matching on the JSON-in-TEXT array columns. A plain
`contains` is a raw substring test over the serialised array, which matched across element
boundaries: filtering nationality `Niger` matched a scholarship restricted to `["Nigeria"]`,
and field `Engineering` matched `["Chemical Engineering"]` — so a facet reporting 4 results
returned 9. Matching the JSON-quoted token restores element-exact semantics. The real fix is
native array columns or join tables once you are on PostgreSQL; these helpers make the
current storage behave correctly in the meantime.
