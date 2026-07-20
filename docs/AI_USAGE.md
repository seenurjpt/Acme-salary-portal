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
The "Ask" feature uses an LLM (Gemini) to translate a natural-language pay question into a
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
See `SYSTEM_PROMPT` in `src/lib/ai.ts` — it constrains the model to emit only JSON matching
the intent schema, with the exact allowed country/department/level values inlined.

## Prompts that shaped the build

The app was built with Claude Code; these are quoted from the actual session logs (lightly
cleaned up for typos). Included because they show how the tool was driven — scoping,
correcting, and verifying — rather than just "generate code".

- **Kickoff, with constraints:** *"Go ahead and develop everything end to end… please keep
  the UI minimal and easy to use from a user's perspective."*
- **Commit hygiene (process, not code):** *"Give me a plan to push the current code as an
  incremental strategy, as mentioned in the assessment… you just stage changes and give me
  the commit message. I will commit and push."* → the phased git history.
- **Realistic data:** *"Seed 10,000 employees, but make sure names match the region — Indian
  employees should have Indian names, other countries per their region."* → the
  region-aware name pools in `prisma/seed.ts`.
- **Product direction for the AI feature:** *"I want Ask AI at the bottom-right corner,
  floating; on click it should become a large right-side panel with animation."*
- **A bug report that became a feature:** *"'salary of Arav Banerjee who is a manager in
  India in Marketing at L3' — I asked this but it showed me an aggregate. The AI should fire
  the exact query the user wants."* → the `lookup` (person search) intent, its capped
  parameterized name search, and tests for it.
- **Cost-driven provider change:** *"Not Claude — any provider, any free model can do it?"*
  → the NL layer moved from the planned Anthropic SDK to Gemini's free REST API. One
  function is the provider seam; the validated-intent safety design didn't change.
- **Verification pressure:** *"Are those analytics real?"* — challenging output instead of
  trusting it; and *"Why are email/password filled automatically?"* → prefilled demo
  credentials removed from the login form (kept as a visible hint instead).

## What I did *not* delegate to AI
- Final data model and the current-salary / history / audit rules.
- The security boundary design for the AI feature (whitelist + validation).
- Trade-off decisions and scope cuts (documented in `docs/TRADEOFFS.md`).
