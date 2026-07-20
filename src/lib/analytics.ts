/**
 * Analytics service — runs QueryIntents and dashboard aggregations through the engine.
 *
 * This is the single place both the dashboard API and the AI Q&A API call. It fetches
 * salary rows once and delegates all math to the pure aggregation module.
 */

import {
  groupStats,
  overallStats,
  distribution,
  compareGroups,
  metricValue,
  type SalaryRow,
  type GroupByField,
  type GroupStat,
  type Metric,
} from "./aggregation";
import type { QueryIntent } from "./query-intent";

export type DashboardData = {
  overall: Omit<GroupStat, "group">;
  byCountry: GroupStat[];
  byDepartment: GroupStat[];
  byLevel: GroupStat[];
  distribution: ReturnType<typeof distribution>;
  headcount: number;
};

export function buildDashboard(rows: SalaryRow[]): DashboardData {
  return {
    overall: overallStats(rows),
    byCountry: groupStats(rows, "country"),
    byDepartment: groupStats(rows, "department"),
    byLevel: groupStats(rows, "level"),
    distribution: distribution(rows, 8),
    headcount: rows.length,
  };
}

function applyFilter(rows: SalaryRow[], filter?: Partial<Record<GroupByField, string>>): SalaryRow[] {
  if (!filter) return rows;
  return rows.filter(
    (r) =>
      (!filter.country || r.country === filter.country) &&
      (!filter.department || r.department === filter.department) &&
      (!filter.level || r.level === filter.level),
  );
}

export type QueryAnswer = {
  intent: QueryIntent;
  /** Human-readable answer summary. */
  summary: string;
  /** Structured numbers backing the answer, so the user can verify. */
  data: unknown;
};

/** Execute a validated QueryIntent against salary rows and produce a verifiable answer. */
export function runIntent(rows: SalaryRow[], intent: QueryIntent): QueryAnswer {
  if (intent.kind === "compare") {
    const cmp = compareGroups(rows, intent.groupBy, intent.groupA, intent.groupB, intent.metric);
    const dir = cmp.difference === 0 ? "the same as" : cmp.difference > 0 ? "higher than" : "lower than";
    const summary =
      cmp.a.value === 0 || cmp.b.value === 0
        ? `Not enough data to compare ${intent.groupA} and ${intent.groupB} by ${intent.groupBy}.`
        : `${intent.groupA} (${fmt(cmp.a.value)}) is ${Math.abs(cmp.percentDifference)}% ${dir} ${intent.groupB} (${fmt(cmp.b.value)}) in ${intent.metric} salary.`;
    return { intent, summary, data: cmp };
  }

  // aggregate
  const filtered = applyFilter(rows, intent.filter);
  if (intent.groupBy) {
    const stats = groupStats(filtered, intent.groupBy);
    const summary = `${cap(intent.metric)} salary by ${intent.groupBy}${filterText(intent.filter)}: ${stats
      .map((s) => `${s.group} ${fmt(metricValue(s, intent.metric as Metric))}`)
      .join(", ")}.`;
    return {
      intent,
      summary,
      data: stats.map((s) => ({ group: s.group, value: metricValue(s, intent.metric as Metric), count: s.count })),
    };
  }

  const stat = overallStats(filtered);
  const value = metricValue(stat, intent.metric as Metric);
  const summary =
    intent.metric === "count"
      ? `There are ${value} employees${filterText(intent.filter)}.`
      : `The ${intent.metric} salary${filterText(intent.filter)} is ${fmt(value)} (across ${stat.count} employees).`;
  return { intent, summary, data: { value, count: stat.count } };
}

function fmt(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function filterText(filter?: Partial<Record<GroupByField, string>>): string {
  if (!filter) return "";
  const parts = Object.entries(filter)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}
