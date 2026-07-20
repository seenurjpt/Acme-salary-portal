/**
 * NL → QueryIntent translation for the pay Q&A feature.
 *
 * Two strategies, tried in order:
 *  1. Gemini (if GEMINI_API_KEY is set) — flexible natural-language understanding, free tier.
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
import { parseIntent, type QueryIntent, type AggregateIntent } from "./query-intent";

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

export type TranslateResult =
  | { ok: true; intent: QueryIntent; source: "ai" | "local" }
  | { ok: false; error: string };

/** Public entry: turn a question into a validated QueryIntent. */
export async function translateQuestion(question: string): Promise<TranslateResult> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const raw = await translateWithGemini(question);
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

const SYSTEM_PROMPT = `You translate an HR manager's question about salaries into a strict JSON QueryIntent.
Output ONLY JSON, no prose. Schemas:
Aggregate: {"kind":"aggregate","metric":"avg|median|min|max|count|sum","groupBy":"country|department|level"(optional),"filter":{"country":..,"department":..,"level":..}(optional)}
Compare:   {"kind":"compare","metric":"avg|median|min|max|count|sum","groupBy":"country|department|level","groupA":"..","groupB":".."}
Lookup:    {"kind":"lookup","name":"<employee name>","filter":{"country":..,"department":..,"level":..}(optional)}
If the question is about ONE specific named person (e.g. "salary of Jane Doe"), use Lookup.
Put any department/country/level qualifiers from the question into "filter" — they help
disambiguate people who share a name.
Allowed countries: ${COUNTRY_NAMES.join(", ")}.
Allowed departments: ${DEPARTMENTS.join(", ")}.
Allowed levels: ${LEVELS.join(", ")}.
Use exact allowed spellings. If a question asks "how many", use metric "count".`;

// --- Gemini strategy (free tier) -------------------------------------------
// Plain REST call — no SDK dependency. Key from https://aistudio.google.com (free tier).
async function translateWithGemini(question: string): Promise<unknown> {
  // Default verified against the free tier (new AI Studio accounts only get quota on
  // the gemini-3.x generation; 2.x models 404 or return 429 "limit: 0" for them).
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: question }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 400,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

// --- Local deterministic strategy -----------------------------------------
// Exported for direct unit testing.
export function translateLocally(question: string): unknown | null {
  const q = question.toLowerCase();

  // Person lookup: "salary of <name>" — only when the target isn't a known group/generic word.
  const lookup = q.match(/\b(?:salary|pay|compensation)\s+(?:of|for)\s+(.+)/);
  if (lookup) {
    const name = lookup[1].split(/\s+(?:who|in|at|from|per|by|across)\b|[,?.!]/)[0].trim();
    const groupWords = [...DEPARTMENTS, ...COUNTRY_NAMES, ...LEVELS].map((g) => g.toLowerCase());
    const isGroupOrGeneric =
      groupWords.includes(name) ||
      /\b(employees?|people|team|department|country|level|each|every|all|everyone)\b/.test(name) ||
      /\band\b|\bvs\.?\b/.test(name);
    if (name.length >= 2 && !isGroupOrGeneric) return { kind: "lookup", name };
  }

  // Require at least one salary-related signal so we don't confidently answer nonsense
  // with a default. If nothing matches, return null and the UI asks the user to rephrase.
  const hasSalarySignal = /\b(salary|salaries|pay|paid|compensation|comp|wage|earn|how much|how many|headcount|employees?)\b/.test(
    q,
  );

  const metric: AggregateIntent["metric"] = /\bmedian\b/.test(q)
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
