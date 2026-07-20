# ACME Salary Management

Web software for an HR Manager to **manage salary data for 10,000 employees across
multiple countries** and **answer questions about how the org pays people** — replacing an
error-prone spreadsheet workflow.

Built with Next.js (App Router) + TypeScript, Prisma + SQLite, and a small set of
hand-built UI components. See [`REQUIREMENTS.md`](REQUIREMENTS.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md), [`PLAN.md`](PLAN.md), and
[`docs/`](docs/) for the thinking behind it.

## Features
- **Employee management** — searchable, filterable, paginated table over 10k rows;
  add / edit / soft-delete with **salary history** and a full **audit trail**.
- **Analytics dashboard** — headcount, avg/median/min/max pay by country, department, and
  level; pay-band table; salary distribution. All figures normalized to **USD** for
  cross-country comparison.
- **Ask (natural-language Q&A)** — ask *"average salary in Germany"* or *"compare
  Engineering and Sales"* in plain English. Powered by Gemini when an API key is present,
  with a **deterministic local parser fallback** so it works offline.
- **Auth** — single HR-Manager role (credentials).

## Quick start
```bash
npm install
cp .env.example .env          # defaults work out of the box (SQLite, local AI fallback)
npm run setup                 # prisma generate + db push + seed 10,000 employees
npm run dev                   # http://localhost:3000
```
Log in with **hr@acme.com / password123** (configurable in `.env`).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run setup` | Generate client, push schema, seed 10k employees |
| `npm run db:reset` | Wipe + re-seed the database |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run typecheck` | TypeScript check |

## Enabling AI Q&A (optional)
Set `GEMINI_API_KEY` in `.env` (Gemini has a free tier — grab a key at
[aistudio.google.com](https://aistudio.google.com)). Without it, the Ask feature uses a
local keyword parser that covers the common question shapes. Either way,
the LLM never runs SQL — it only
proposes a **whitelisted, Zod-validated query intent** that runs through the same tested
aggregation engine the dashboard uses. (See [`ARCHITECTURE.md`](ARCHITECTURE.md) → *AI safety*.)

## Testing
```bash
npm test
```
Tests focus on the correctness core — the pure aggregation engine (currency normalization,
grouping, distribution, comparison edge cases) — plus the AI-safety boundary (the local
parser and intent validation). They are fast, deterministic, and offline.

## Project structure
```
prisma/            schema + deterministic 10k seed
src/lib/           domain core: aggregation engine, analytics, query-intent, ai, employees (data access)
src/app/api/       REST endpoints (employees, analytics, ask, auth)
src/app/           pages: dashboard (/), employees, ask, login
src/components/    UI primitives, nav, charts
docs/              AI usage log + trade-off notes
```

## Deployment (Vercel + Neon)
The app deploys to **Vercel** with the database on **Neon** (serverless Postgres, free tier).

1. **Neon**: create a project at [neon.tech](https://neon.tech), copy the pooled connection
   string into `DATABASE_URL`, then `npx prisma db push && npm run db:seed`.
2. **Vercel**: import the GitHub repo (Next.js auto-detected; the build script already runs
   `prisma generate`) and set the environment variables:
   `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `HR_EMAIL`, `HR_PASSWORD`,
   and optionally `GEMINI_API_KEY` for the AI path of Ask.

The schema is portable — a fully-offline local demo can switch back to SQLite by setting
`provider = "sqlite"` in `prisma/schema.prisma` and `DATABASE_URL="file:./dev.db"`.
