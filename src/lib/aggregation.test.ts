import { describe, it, expect } from "vitest";
import {
  mean,
  median,
  normalize,
  overallStats,
  groupStats,
  distribution,
  compareGroups,
  type SalaryRow,
} from "./aggregation";

// Fixtures use USD so baseAmount === amount, keeping expectations obvious.
const usd = (amount: number, over: Partial<SalaryRow> = {}): SalaryRow => ({
  amount,
  currency: "USD",
  country: "United States",
  department: "Engineering",
  level: "L3",
  ...over,
});

describe("mean / median", () => {
  it("computes mean", () => {
    expect(mean([10, 20, 30])).toBe(20);
  });
  it("returns 0 for empty mean", () => {
    expect(mean([])).toBe(0);
  });
  it("median of odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("median of even-length list averages the middle two", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns 0 for empty median", () => {
    expect(median([])).toBe(0);
  });
});

describe("normalize (currency)", () => {
  it("converts to base currency (USD) using FX rates", () => {
    // 92 EUR at rate 0.92/USD => 100 USD
    const [row] = normalize([usd(92, { currency: "EUR" })]);
    expect(row.baseAmount).toBeCloseTo(100, 5);
  });
  it("leaves USD unchanged", () => {
    const [row] = normalize([usd(100)]);
    expect(row.baseAmount).toBe(100);
  });
  it("throws on unknown currency", () => {
    expect(() => normalize([usd(100, { currency: "XXX" })])).toThrow(/Unknown currency/);
  });
});

describe("overallStats", () => {
  it("computes count/avg/median/min/max/sum", () => {
    const s = overallStats([usd(100), usd(200), usd(300)]);
    expect(s).toMatchObject({ count: 3, avg: 200, median: 200, min: 100, max: 300, sum: 600 });
  });
  it("handles empty input", () => {
    expect(overallStats([])).toMatchObject({ count: 0, avg: 0, median: 0 });
  });
});

describe("groupStats", () => {
  const rows = [
    usd(100, { country: "United States" }),
    usd(200, { country: "United States" }),
    usd(300, { country: "Germany", currency: "USD" }),
  ];
  it("groups by field and sorts by group name", () => {
    const g = groupStats(rows, "country");
    expect(g.map((x) => x.group)).toEqual(["Germany", "United States"]);
  });
  it("computes correct per-group stats", () => {
    const g = groupStats(rows, "country");
    const us = g.find((x) => x.group === "United States")!;
    expect(us).toMatchObject({ count: 2, avg: 150, min: 100, max: 200 });
  });
  it("normalizes currency inside groups", () => {
    const g = groupStats(
      [usd(92, { country: "Germany", currency: "EUR" })],
      "country",
    );
    expect(g[0].avg).toBe(100);
  });
});

describe("distribution", () => {
  it("returns empty for no rows", () => {
    expect(distribution([])).toEqual([]);
  });
  it("puts every row in a bucket (counts sum to N)", () => {
    const rows = Array.from({ length: 50 }, (_, i) => usd(50_000 + i * 1000));
    const buckets = distribution(rows, 5);
    expect(buckets.reduce((a, b) => a + b.count, 0)).toBe(50);
  });
  it("collapses to a single bucket when all values equal", () => {
    const buckets = distribution([usd(100), usd(100)]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(2);
  });
});

describe("compareGroups", () => {
  const rows = [
    usd(100, { department: "Engineering" }),
    usd(200, { department: "Engineering" }),
    usd(100, { department: "Sales" }),
  ];
  it("computes difference and percent difference", () => {
    const c = compareGroups(rows, "department", "Engineering", "Sales", "avg");
    expect(c.a.value).toBe(150);
    expect(c.b.value).toBe(100);
    expect(c.difference).toBe(50);
    expect(c.percentDifference).toBe(50);
  });
  it("percentDifference is 0 when comparator group is absent (value 0)", () => {
    const c = compareGroups(rows, "department", "Engineering", "Finance", "avg");
    expect(c.b.value).toBe(0);
    expect(c.percentDifference).toBe(0);
  });
});
