# Architecture

## Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One repo, one deploy (Vercel). API via route handlers. Matches the Node/React JD. |
| DB | **SQLite** (dev/demo) via **Prisma** | Zero-setup, file-based, perfect for a seeded 10k demo. Prisma gives typed queries + easy Postgres swap for prod. |
| UI | React + **shadcn/ui** + **Tailwind** | Accessible, unopinionated primitives; fast to build a clean HR console. |
| Charts | **Recharts** | Simple, declarative, good enough for the analytics dashboard. |
| Validation | **Zod** | One schema shared by API input validation + forms + AI-output parsing. |
| Tests | **Vitest** + **React Testing Library** | Fast, deterministic. Playwright for one happy-path e2e (optional). |
| Auth | **Auth.js (credentials)** | Single HR-Manager role; shows the auth seam without RBAC sprawl. |
| AI | **Claude (Anthropic SDK)** | NL→structured-query translation for the Q&A feature. |

## Layered design (the key decision)
```
UI (pages, forms, dashboard, Q&A box)
        │  calls
API route handlers  ── validate (Zod) ── auth guard
        │
Service layer  ←── the aggregation/query engine lives here
        │          (pure functions: avgByCountry, payBands, compare…)
Prisma (data access)
        │
SQLite
```
**The analytics engine and the AI Q&A share one aggregation service.** The AI does *not*
write SQL. Instead the LLM maps a question to a **structured intent**
(`{ metric: 'avg', field: 'salary', groupBy: 'country', filter: {...} }`) validated by Zod
against a **whitelist** of allowed metrics/fields. That intent runs through the *same* tested
service functions the dashboard uses. → Safe (no arbitrary SQL), deterministic to test, and
the AI can't do anything the dashboard couldn't.

## Data model (v1)
- **Employee**: id, name, email, country, department, jobTitle, level, hireDate.
- **SalaryRecord**: id, employeeId, amount, currency, effectiveDate, isCurrent.
  (History via multiple records → supports raises/audit without mutation.)
- **AuditLog**: id, entity, entityId, action, before(JSON), after(JSON), actor, timestamp.
- Base-currency normalization via a static `fxRates` table/const.
- Indexes on country, department, level, employeeId for fast filtered aggregation at 10k rows.

## Performance notes
- All aggregation runs **in the database** (Prisma `groupBy` / raw aggregate) — never in JS over 10k rows.
- Table uses **cursor/offset pagination** + server-side filtering.
- Dashboard aggregates are cacheable (React Query / route cache).

## AI safety
- LLM output → Zod-validated intent → whitelist check → parameterized service call.
- Read-only: the AI path has no access to mutation services.
- Graceful degradation: if the API key is missing or the call fails, the UI shows the
  structured dashboard and a "Q&A unavailable" notice — the app is fully usable without AI.
