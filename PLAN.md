# Implementation Plan

Sequenced for **incremental commits** — each phase is a commit (or a few), so the history
tells the story the assessment asks for. Estimated ~1.5–2 focused days.

## Phase 0 — Artifacts & scaffold  *(commit: "docs: requirements, architecture, plan")*
- [x] REQUIREMENTS.md, ARCHITECTURE.md, PLAN.md
- [ ] `docs/AI_USAGE.md` (running log of prompts/decisions), `docs/TRADEOFFS.md`
- [ ] `create-next-app` (TS, Tailwind, App Router), add shadcn/ui, Prisma, Vitest, Zod, Recharts.
- [ ] CI-lite: `npm run test`, `lint`, `typecheck` scripts.

## Phase 1 — Data model & seed  *(commit: "feat: schema + 10k seed")*
- [ ] Prisma schema: Employee, SalaryRecord, AuditLog, fxRates.
- [ ] Migration + indexes.
- [ ] `seed.ts`: 10,000 employees across ~8 countries, ~6 departments, 5 levels, realistic
      salary distributions per country/level, currencies per country. Deterministic seed (fixed RNG seed).
- [ ] **Test:** seed produces 10k rows; salary ranges sane per level.

## Phase 2 — Aggregation service (the core, test-first)  *(commit: "feat: aggregation engine + tests")*
- [ ] Pure service fns: `avgByGroup`, `median`, `payBands`, `distribution`, `compareGroups`,
      currency normalization.
- [ ] Zod **QueryIntent** schema + whitelist of metrics/fields/groupBy.
- [ ] **Tests first** — this is the most-tested layer (deterministic, fast). Cover currency
      normalization, grouping, empty sets, band edges.

## Phase 3 — API layer  *(commit: "feat: REST API + validation")*
- [ ] `/api/employees` (list w/ filter+pagination, get, create, update, soft-delete).
- [ ] `/api/analytics` (dashboard aggregates).
- [ ] `/api/query` (accepts a validated QueryIntent → aggregation service).
- [ ] Zod validation on every input; AuditLog written on every mutation.
- [ ] **Tests:** API integration (validation rejects bad input, audit rows written, pagination).

## Phase 4 — Auth  *(commit: "feat: HR-manager auth")*
- [ ] Auth.js credentials, one seeded HR user, protect all routes/pages. (No RBAC — see requirements.)

## Phase 5 — UI: manage  *(commit: "feat: employee console UI")*
- [ ] Employee table: server-side search/filter/paginate over 10k, add/edit forms, salary history view.
- [ ] Optimistic-ish UX, loading/empty/error states.

## Phase 6 — UI: analytics dashboard  *(commit: "feat: analytics dashboard")*
- [ ] Cards (avg/median by country/dept/level), pay-band table, distribution + comparison charts.
- [ ] Filters drive the same `/api/analytics`.

## Phase 7 — AI Q&A layer  *(commit: "feat: natural-language pay Q&A")*
- [ ] `/api/ask`: question → Claude → **QueryIntent** (Zod-validated, whitelisted) → aggregation service → answer + the numbers used.
- [ ] Graceful fallback if no API key / LLM error.
- [ ] **Tests:** mock LLM → deterministic intent → correct aggregation; malformed/unsafe intent rejected.

## Phase 8 — Polish, deploy, demo  *(commit: "chore: deploy + demo")*
- [ ] README (run/seed/test), deploy to Vercel (+ hosted DB or bundled SQLite note).
- [ ] Short screen-recording demo.
- [ ] Final pass: `docs/AI_USAGE.md` + `docs/TRADEOFFS.md` complete.

## Testing strategy
- **Heaviest** on the aggregation engine (pure, fast, deterministic) — the correctness core.
- API tests for validation/audit/pagination contracts.
- A few component tests (table filtering, form validation) + optional 1 e2e happy path.
- AI layer tested with a **mocked LLM** so tests stay deterministic and offline.

## Risks / mitigations
- *10k perf* → DB-side aggregation + indexes + pagination (never load all rows client-side).
- *AI non-determinism/safety* → LLM only emits a whitelisted intent; real work is deterministic + tested.
- *Deploy + SQLite on Vercel* → note the Postgres/Turso swap; Prisma makes it a config change.
