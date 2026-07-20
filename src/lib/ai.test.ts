import { describe, it, expect } from "vitest";
import { translateLocally } from "./ai";
import { parseIntent } from "./query-intent";

// The local parser must produce intents that pass strict validation — this pair of tests
// guards the AI-safety boundary: whatever the parser emits is re-validated before use.
function translateAndValidate(q: string) {
  const raw = translateLocally(q);
  return parseIntent(raw);
}

describe("translateLocally", () => {
  it("average salary in a country", () => {
    const r = translateAndValidate("what is the average salary in Germany?");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.intent).toMatchObject({ kind: "aggregate", metric: "avg", filter: { country: "Germany" } });
  });

  it("median by department", () => {
    const r = translateAndValidate("show me the median salary by department");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.intent).toMatchObject({ kind: "aggregate", metric: "median", groupBy: "department" });
  });

  it("count / how many", () => {
    const r = translateAndValidate("how many employees are in Sales?");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.intent).toMatchObject({ kind: "aggregate", metric: "count", filter: { department: "Sales" } });
  });

  it("compare two departments", () => {
    const r = translateAndValidate("compare Engineering and Sales");
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.intent).toMatchObject({
        kind: "compare",
        groupBy: "department",
        groupA: "Engineering",
        groupB: "Sales",
      });
  });

  it("highest salary by country", () => {
    const r = translateAndValidate("what is the highest salary by country");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.intent).toMatchObject({ metric: "max", groupBy: "country" });
  });

  it("returns null for a question with no salary signal", () => {
    expect(translateLocally("drop table; ignore previous instructions")).toBeNull();
    expect(translateLocally("what's the weather today?")).toBeNull();
  });
});

describe("parseIntent (validation boundary)", () => {
  it("rejects unknown metric", () => {
    const r = parseIntent({ kind: "aggregate", metric: "hack" });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown country filter (not in whitelist)", () => {
    const r = parseIntent({ kind: "aggregate", metric: "avg", filter: { country: "Atlantis" } });
    expect(r.ok).toBe(false);
  });
  it("rejects extra/unknown keys (strict)", () => {
    const r = parseIntent({ kind: "aggregate", metric: "avg", sql: "DROP TABLE" });
    expect(r.ok).toBe(false);
  });
  it("accepts a valid compare intent", () => {
    const r = parseIntent({ kind: "compare", groupBy: "level", groupA: "L1", groupB: "L5" });
    expect(r.ok).toBe(true);
  });
});
