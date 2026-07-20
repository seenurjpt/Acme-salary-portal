/**
 * Aggregation engine — the correctness core of the app.
 *
 * These are PURE functions over a normalized salary row shape. They know nothing about
 * Prisma, HTTP, or React. Both the analytics dashboard and the AI Q&A layer run their
 * numbers through here, so this is the most heavily unit-tested module (see aggregation.test.ts).
 *
 * All salaries are normalized to the base currency (USD) before aggregation so that
 * cross-country comparisons are apples-to-apples.
 */

import { toBaseCurrency } from "./reference";

/** Minimal shape the engine needs — decoupled from the DB model. */
export type SalaryRow = {
  amount: number;
  currency: string;
  country: string;
  department: string;
  level: string;
};

/** A row with its salary already normalized to base currency. */
export type NormalizedRow = SalaryRow & { baseAmount: number };

export type GroupByField = "country" | "department" | "level";
export type Metric = "avg" | "median" | "min" | "max" | "count" | "sum";

export type GroupStat = {
  group: string;
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  sum: number;
};

export function normalize(rows: SalaryRow[]): NormalizedRow[] {
  return rows.map((r) => ({ ...r, baseAmount: toBaseCurrency(r.amount, r.currency) }));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Round to whole currency units for display-friendly, deterministic output. */
export function round(n: number): number {
  return Math.round(n);
}

function statsFor(values: number[]): Omit<GroupStat, "group"> {
  if (values.length === 0) {
    return { count: 0, avg: 0, median: 0, min: 0, max: 0, sum: 0 };
  }
  return {
    count: values.length,
    avg: round(mean(values)),
    median: round(median(values)),
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    sum: round(values.reduce((a, b) => a + b, 0)),
  };
}

/** Group rows by a field and compute full stats per group, sorted by group name. */
export function groupStats(
  rows: SalaryRow[],
  groupBy: GroupByField,
): GroupStat[] {
  const normalized = normalize(rows);
  const buckets = new Map<string, number[]>();
  for (const row of normalized) {
    const key = row[groupBy];
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row.baseAmount);
  }
  return [...buckets.entries()]
    .map(([group, values]) => ({ group, ...statsFor(values) }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

/** Overall stats across all rows (no grouping). */
export function overallStats(rows: SalaryRow[]): Omit<GroupStat, "group"> {
  return statsFor(normalize(rows).map((r) => r.baseAmount));
}

/** Pick a single metric value from a stats object. */
export function metricValue(stat: Omit<GroupStat, "group">, metric: Metric): number {
  return stat[metric];
}

/**
 * Salary distribution as histogram buckets (in base currency).
 * Returns fixed-width buckets covering min..max, useful for a distribution chart.
 */
export type Bucket = { label: string; min: number; max: number; count: number };

export function distribution(rows: SalaryRow[], bucketCount = 8): Bucket[] {
  const values = normalize(rows).map((r) => r.baseAmount);
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) {
    return [{ label: `${round(lo)}`, min: lo, max: hi, count: values.length }];
  }
  const width = (hi - lo) / bucketCount;
  const buckets: Bucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: `${round(lo + i * width) / 1000}k–${round(lo + (i + 1) * width) / 1000}k`,
    min: lo + i * width,
    max: lo + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    // last bucket is inclusive of the max
    let idx = Math.floor((v - lo) / width);
    if (idx >= bucketCount) idx = bucketCount - 1;
    buckets[idx].count++;
  }
  return buckets;
}

/** Compare two groups on a metric — powers "how does X compare to Y" questions. */
export type Comparison = {
  groupBy: GroupByField;
  metric: Metric;
  a: { group: string; value: number };
  b: { group: string; value: number };
  difference: number; // a - b
  percentDifference: number; // (a - b) / b * 100, 0 when b is 0
};

export function compareGroups(
  rows: SalaryRow[],
  groupBy: GroupByField,
  groupA: string,
  groupB: string,
  metric: Metric = "avg",
): Comparison {
  const stats = groupStats(rows, groupBy);
  const findVal = (g: string) => {
    const s = stats.find((x) => x.group === g);
    return s ? metricValue(s, metric) : 0;
  };
  const aVal = findVal(groupA);
  const bVal = findVal(groupB);
  return {
    groupBy,
    metric,
    a: { group: groupA, value: aVal },
    b: { group: groupB, value: bVal },
    difference: aVal - bVal,
    percentDifference: bVal === 0 ? 0 : round(((aVal - bVal) / bVal) * 100),
  };
}
