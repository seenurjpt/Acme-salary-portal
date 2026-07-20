/**
 * QueryIntent — the safe, structured representation of a pay question.
 *
 * This is the security boundary for the AI Q&A feature. The LLM never writes SQL or code;
 * it may ONLY emit a QueryIntent, which is validated by Zod against a strict whitelist of
 * metrics, fields, and filter values. The validated intent then runs through the same
 * tested aggregation engine the dashboard uses. Anything the LLM can express here, the
 * dashboard could already do — so the AI path can never exceed the app's own capabilities,
 * and it is strictly read-only.
 */

import { z } from "zod";
import { DEPARTMENTS, LEVELS, COUNTRIES } from "./reference";

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name) as [string, ...string[]];

export const GroupByFieldSchema = z.enum(["country", "department", "level"]);
export const MetricSchema = z.enum(["avg", "median", "min", "max", "count", "sum"]);

/** Optional filters — each constrained to known values so no arbitrary input reaches the DB. */
export const FilterSchema = z
  .object({
    country: z.enum(COUNTRY_NAMES).optional(),
    department: z.enum(DEPARTMENTS).optional(),
    level: z.enum(LEVELS).optional(),
  })
  .strict();

/**
 * Three intent shapes:
 *  - "aggregate": one metric, optionally grouped and/or filtered.
 *  - "compare": two named groups compared on a metric.
 *  - "lookup": one specific employee by name. The name is free text but is only ever
 *    used as a parameterized `contains` match in a read-only query — never interpolated.
 */
export const AggregateIntentSchema = z
  .object({
    kind: z.literal("aggregate"),
    metric: MetricSchema,
    groupBy: GroupByFieldSchema.optional(),
    filter: FilterSchema.optional(),
  })
  .strict();

export const CompareIntentSchema = z
  .object({
    kind: z.literal("compare"),
    metric: MetricSchema.default("avg"),
    groupBy: GroupByFieldSchema,
    groupA: z.string().min(1),
    groupB: z.string().min(1),
  })
  .strict();

export const LookupIntentSchema = z
  .object({
    kind: z.literal("lookup"),
    name: z.string().trim().min(2).max(80),
    filter: FilterSchema.optional(),
  })
  .strict();

export const QueryIntentSchema = z.discriminatedUnion("kind", [
  AggregateIntentSchema,
  CompareIntentSchema,
  LookupIntentSchema,
]);

export type QueryIntent = z.infer<typeof QueryIntentSchema>;
export type AggregateIntent = z.infer<typeof AggregateIntentSchema>;
export type CompareIntent = z.infer<typeof CompareIntentSchema>;
export type LookupIntent = z.infer<typeof LookupIntentSchema>;

/** Parse unknown input (e.g. LLM JSON output) into a validated intent, or return an error. */
export function parseIntent(input: unknown):
  | { ok: true; intent: QueryIntent }
  | { ok: false; error: string } {
  const result = QueryIntentSchema.safeParse(input);
  if (result.success) return { ok: true, intent: result.data };
  return { ok: false, error: result.error.issues.map((i) => i.message).join("; ") };
}
