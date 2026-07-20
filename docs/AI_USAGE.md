# AI Usage Notes

How AI tooling was used to build this, and — just as important — where I kept humans in the
loop for correctness.

## How AI was used
- **Planning & framing.** Used AI to pressure-test the product framing: which query approach
  best serves the HR-Manager persona, what to deliberately leave out, and why. The
  conclusions live in `REQUIREMENTS.md`.
- **Scaffolding & boilerplate.** Config (Next.js, Tailwind, Vitest, Prisma), route handlers,
  and UI primitives were AI-accelerated, then reviewed and adjusted by hand.
- **Test-first on the core.** The aggregation engine was specced as pure functions and its
  tests written alongside the implementation, so correctness is pinned by fast, deterministic
  unit tests rather than by trusting generated code.

## Where AI is used *inside* the product
The "Ask" feature uses an LLM (Claude) to translate a natural-language pay question into a
**structured `QueryIntent`** — never into SQL or code. Design principles:
1. **The LLM proposes; the system disposes.** LLM output is JSON that must pass a strict Zod
   schema (`src/lib/query-intent.ts`) whitelisting every allowed metric, field, and filter
   value. Anything else is rejected.
2. **No new capability.** A validated intent runs through the *same* aggregation service the
   dashboard uses, so the AI path can do nothing the UI couldn't already do. It is read-only.
3. **Graceful degradation.** With no API key, a deterministic local parser handles the common
   question shapes. The feature — and its tests — work fully offline.

This keeps a non-deterministic component (the LLM) from ever touching a
correctness- or security-sensitive path.

## Prompt used for NL → intent
See `SYSTEM_PROMPT` in `src/lib/ai.ts` — it constrains Claude to emit only JSON matching the
intent schema, with the exact allowed country/department/level values inlined.

## What I did *not* delegate to AI
- Final data model and the current-salary / history / audit rules.
- The security boundary design for the AI feature (whitelist + validation).
- Trade-off decisions and scope cuts (documented in `docs/TRADEOFFS.md`).
