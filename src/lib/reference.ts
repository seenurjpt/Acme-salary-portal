/**
 * Reference data: countries, departments, levels, currencies, and static FX rates.
 *
 * FX rates are static by design (see REQUIREMENTS.md): a demo needs determinism and no
 * external dependency. Swapping in a live FX API later means replacing `fxRates` with a
 * fetch — everything downstream normalizes through `toBaseCurrency`.
 */

export const BASE_CURRENCY = "USD";

export type CountryInfo = {
  name: string;
  currency: string;
  /** rough salary multiplier vs a US baseline, for realistic seeding */
  costFactor: number;
};

export const COUNTRIES: CountryInfo[] = [
  { name: "United States", currency: "USD", costFactor: 1.0 },
  { name: "United Kingdom", currency: "GBP", costFactor: 0.85 },
  { name: "Germany", currency: "EUR", costFactor: 0.8 },
  { name: "India", currency: "INR", costFactor: 0.25 },
  { name: "Canada", currency: "CAD", costFactor: 0.78 },
  { name: "Australia", currency: "AUD", costFactor: 0.82 },
  { name: "Singapore", currency: "SGD", costFactor: 0.9 },
  { name: "Brazil", currency: "BRL", costFactor: 0.45 },
];

export const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Finance",
  "Human Resources",
  "Operations",
] as const;

export const LEVELS = ["L1", "L2", "L3", "L4", "L5"] as const;
export type Level = (typeof LEVELS)[number];

/** Base annual salary (in USD) midpoint per level — used for seeding + pay-band reference. */
export const LEVEL_BASE_USD: Record<Level, number> = {
  L1: 55_000,
  L2: 80_000,
  L3: 115_000,
  L4: 160_000,
  L5: 220_000,
};

/** Static FX rates: how many units of `currency` per 1 USD. */
export const fxRates: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  INR: 83.0,
  CAD: 1.36,
  AUD: 1.52,
  SGD: 1.34,
  BRL: 5.0,
};

/** Convert an amount in `currency` to the base currency (USD). */
export function toBaseCurrency(amount: number, currency: string): number {
  const rate = fxRates[currency];
  if (!rate) {
    throw new Error(`Unknown currency: ${currency}`);
  }
  return amount / rate;
}

export const CURRENCIES = Object.keys(fxRates);
