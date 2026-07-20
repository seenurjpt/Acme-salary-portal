/**
 * NL → QueryIntent translation for the pay Q&A feature.
 *
 * Two strategies, tried in order:
 *  1. Claude (if ANTHROPIC_API_KEY is set) — flexible natural-language understanding.
 *  2. A deterministic local parser — keyword/entity matching so the feature works offline,
 *     costs nothing, and keeps tests deterministic.
 *
 * Either way the output is a plain object that MUST pass QueryIntentSchema validation before
 * it is trusted (see api/ask). The LLM is never allowed to run code or SQL — it only
 * proposes an intent.
 */

import {
  COUNTRIES,
  DEPARTMENTS,
  LEVELS,
} from "./reference";
import { parseIntent, type QueryIntent } from "./query-intent";

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

export type TranslateResult =
  | { ok: true; intent: QueryIntent; source: "ai" | "local" }
  | { ok: false; error: string };

/** Public entry: turn a question into a validated QueryIntent. */
export async function translateQuestion(question: string): Promise<TranslateResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const raw = await translateWithClaude(question);
      const parsed = parseIntent(raw);
      if (parsed.ok) return { ok: true, intent: parsed.intent, source: "ai" };
    } catch {
      // fall through to local parser
    }
  }
  const local = translateLocally(question);
  if (local) {
    const parsed = parseIntent(local);
    if (parsed.ok) return { ok: true, intent: parsed.intent, source: "local" };
  }
  return {
    ok: false,
    error:
      "I couldn't interpret that. Try e.g. \"average salary in Germany\", " +
      '"median salary by department", or "compare Engineering and Sales".',
  };
}

// --- Claude strategy -------------------------------------------------------
const SYSTEM_PROMPT = `You translate an HR manager's question about salaries into a strict JSON QueryIntent.
Output ONLY JSON, no prose. Schemas:
Aggregate: {"kind":"aggregate","metric":"avg|median|min|max|count|sum","groupBy":"country|department|level"(optional),"filter":{"country":..,"department":..,"level":..}(optional)}
Compare:   {"kind":"compare","metric":"avg|median|min|max|count|sum","groupBy":"country|department|level","groupA":"..","groupB":".."}
Allowed countries: ${COUNTRY_NAMES.join(", ")}.
Allowed departments: ${DEPARTMENTS.join(", ")}.
Allowed levels: ${LEVELS.join(", ")}.
Use exact allowed spellings. If a question asks "how many", use metric "count".`;

async function translateWithClaude(question: string): Promise<unknown> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: question }],
  });
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

// --- Local deterministic strategy -----------------------------------------
// Exported for direct unit testing.
export function translateLocally(question: string): unknown | null {
  const q = question.toLowerCase();

  // Require at least one salary-related signal so we don't confidently answer nonsense
  // with a default. If nothing matches, return null and the UI asks the user to rephrase.
  const hasSalarySignal = /\b(salary|salaries|pay|paid|compensation|comp|wage|earn|how much|how many|headcount|employees?)\b/.test(
    q,
  );

  const metric: QueryIntent["metric"] = /\bmedian\b/.test(q)
    ? "median"
    : /\bhighest|max(imum)?\b/.test(q)
      ? "max"
      : /\blowest|min(imum)?\b/.test(q)
        ? "min"
        : /\btotal|sum\b/.test(q)
          ? "sum"
          : /\bhow many|count|number of\b/.test(q)
            ? "count"
            : "avg";

  const foundCountry = COUNTRY_NAMES.find((c) => q.includes(c.toLowerCase()));
  const foundDept = DEPARTMENTS.find((d) => q.includes(d.toLowerCase()));
  const foundLevel = LEVELS.find((l) => q.includes(l.toLowerCase()));

  // Compare: "compare X and Y" or "X vs Y"
  if (/\bcompare\b|\bvs\.?\b|\bversus\b/.test(q)) {
    const depts = DEPARTMENTS.filter((d) => q.includes(d.toLowerCase()));
    const countries = COUNTRY_NAMES.filter((c) => q.includes(c.toLowerCase()));
    if (depts.length >= 2)
      return { kind: "compare", metric, groupBy: "department", groupA: depts[0], groupB: depts[1] };
    if (countries.length >= 2)
      return { kind: "compare", metric, groupBy: "country", groupA: countries[0], groupB: countries[1] };
  }

  // Grouped: "by country / department / level"
  let groupBy: "country" | "department" | "level" | undefined;
  if (/\bby country|per country|each country\b/.test(q)) groupBy = "country";
  else if (/\bby department|per department|by team\b/.test(q)) groupBy = "department";
  else if (/\bby level|per level|by seniority\b/.test(q)) groupBy = "level";

  const filter: Record<string, string> = {};
  if (foundCountry) filter.country = foundCountry;
  if (foundDept) filter.department = foundDept;
  if (foundLevel) filter.level = foundLevel;

  const hasSignal =
    hasSalarySignal || groupBy || Object.keys(filter).length > 0 || metric !== "avg";
  if (!hasSignal) return null; // nothing to go on — let the caller ask for a rephrase

  const intent: Record<string, unknown> = { kind: "aggregate", metric };
  if (groupBy) intent.groupBy = groupBy;
  if (Object.keys(filter).length) intent.filter = filter;

  return intent;
}
