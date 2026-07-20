# Trade-offs & Decisions

Decisions I made, the alternatives, and why. The theme: **maximize signal on the persona's
real jobs, minimize accidental complexity.**

## Product

**Query approach: structured dashboard *and* NL Q&A (not one or the other).**
The dashboard is the reliable, testable core an HR manager uses daily; the NL "Ask" box is
the fast path for ad-hoc questions. Crucially, both are backed by the *same* aggregation
engine — so the AI layer adds convenience without a second, divergent source of truth.

**Single HR-Manager role, no RBAC.**
Per the assessment guidance, one authenticated role meets the requirements. I built the auth
*seam* (so adding roles later is localized) but didn't build admin/read-only tiers — that
complexity wouldn't serve the stated persona.

## Data

**Salary history via records, not in-place edits.**
A raise creates a new `SalaryRecord` and marks the previous one non-current, instead of
overwriting a number. Money data must be traceable; this also makes "what did they earn in
2022" answerable for free.

**Multi-currency with a static FX table.**
Salaries are stored in local currency and normalized to USD for comparison. FX rates are a
static table, not a live API — chosen for determinism, testability, and zero external
dependency in a demo. `toBaseCurrency` is the single seam to swap in a live feed later.

**Audit log on every mutation.**
Cheap to add, high value for a system of record over compensation.

## Architecture

**Aggregation is pure and shared.**
The engine (`src/lib/aggregation.ts`) knows nothing about Prisma/HTTP/React. This is what
makes it heavily unit-testable and lets the dashboard and AI reuse it. It's the deliberate
center of gravity of the codebase.

**AI emits a validated intent, never SQL.**
The single most important safety decision — see `docs/AI_USAGE.md`. Trade-off: the local
parser covers common questions but not every phrasing. That's acceptable because (a) with an
API key Gemini handles the long tail, and (b) unrecognized questions fail safe with a helpful
"try rephrasing" message rather than a wrong answer.

**Server-side pagination; in-memory aggregation at 10k rows.**
Filtering and counting happen in Postgres with indexes; the client never loads all rows. The
dashboard reads current-salary rows once and aggregates in memory — fine at 10k; if this grew
to millions, the aggregations would move into SQL `GROUP BY` (the service boundary makes that
a localized change). The full analysis is in `ARCHITECTURE.md` → *Performance considerations*.

**Gemini over the planned Claude for NL → intent.**
The plan said Anthropic SDK; the build shipped Gemini via a plain REST call. Driver: anyone
reviewing this can exercise the real AI path on a free-tier key with zero billing setup, and
it's one less SDK dependency. The safety design is provider-agnostic and the seam is a single
function (`translateWithGemini`) — swapping providers is a localized change.

**Neon Postgres over the planned SQLite.**
SQLite was planned for zero-setup local dev, but the app is deployed (Vercel), which needs a
durable hosted DB — and dev/prod parity beats file-DB convenience. The schema stays portable;
the fully-offline SQLite fallback is a two-line switch documented in `.env.example`.

## Testing

**Heaviest coverage on the correctness core, lighter on glue.**
The aggregation engine and the AI-safety boundary (intent validation + local parser) are the
places a bug would be costly and silent, so that's where the tests concentrate. API and UI
glue was verified with runtime smoke tests during development. Given more time I'd add
Playwright happy-path e2e and API-level integration tests.

## Deliberately left out (and why)
Payroll/tax processing, live FX, employee self-service, approval workflows, and full RBAC —
each is a real feature for a production HR suite but outside this exercise's problem
(*manage salary data + answer pay questions* for one persona). Listed in `REQUIREMENTS.md`.
