# Salary Management — Requirements (One-Pager)

**Author:** Sunny · **Date:** 2026-07-20 · **Status:** Pre-build

## Goal
Give the **HR Manager** of ACME (10,000 employees, multiple countries) a web app to
**manage salary data** and **answer questions about how the org pays people** —
replacing the current error-prone spreadsheet workflow.

## Persona & Primary Jobs-to-be-Done
The HR Manager needs to:
1. Find and view any employee's compensation quickly.
2. Add / edit / correct salary records (with an audit trail — money data must be traceable).
3. Answer pay questions on the fly: *"What's the average salary in Germany?"*,
   *"Which roles are paid above band?"*, *"How does Engineering compare to Sales?"*

## Scope & Features (In)
| Area | Feature |
|---|---|
| **CRUD** | Employee + salary records: create, read, update, soft-delete. |
| **Browse** | Paginated, searchable, filterable table (country, department, level) over 10k rows. |
| **Analytics** | Dashboard: headcount & avg/median/min/max pay by country, department, level; pay-band ranges; distribution charts. All deterministic aggregations. |
| **AI Q&A** | Natural-language box: *"avg salary in Germany?"* → LLM translates to a **whitelisted, read-only** aggregation query → answer + the numbers it used. Falls back gracefully; never mutates data. |
| **Audit** | Every salary change records who/when/old→new. |
| **Multi-currency** | Store amount + currency; normalize to a base currency (e.g. USD) for cross-country comparison via a static rate table. |
| **Seed** | Script generating 10,000 realistic employees across countries/depts/levels. |

## Deliberately Out of Scope (and why)
- **Role-based access control (admin vs read-only).** Per assessment guidance, a single
  authenticated HR Manager role is sufficient. I ship simple auth to show the seam, but skip
  full RBAC to keep focus on the core product. *Why: not critical to the persona's core jobs.*
- **Payroll processing / payslip generation / tax.** This is a *data management + insight*
  tool, not a payroll engine. *Why: massive domain, out of the stated problem.*
- **Live FX rates.** Static rate table instead of a live FX API. *Why: determinism, testability, no external dependency for a demo; the seam to swap it in is trivial.*
- **Employee self-service portal.** Only the HR Manager persona is in scope.
- **Approval workflows / e-sign.** Nice for a real org; not needed to prove the product idea.
- **Real-time collaboration.** Single-user tool for this exercise.

## Non-Functional Requirements
- Table & analytics must stay responsive at **10k rows** (indexed queries, DB-side aggregation, pagination — never load all rows into the client).
- AI Q&A must be **safe** (read-only, query whitelist/validation — no arbitrary SQL execution) and **degradable** (works, with a clear message, if the LLM is unavailable).
- Core aggregation logic is **pure/unit-testable** and shared by both the dashboard and the AI layer.

## Success Criteria
HR Manager can, in under a minute: find an employee, correct their salary, and get a
trustworthy answer to a pay question — with numbers they can verify.
