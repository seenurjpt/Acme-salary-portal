"use client";

/**
 * Display-currency context — the user picks a currency in the navbar and every money
 * figure in the UI renders converted to it. Purely presentational: data is stored in
 * each employee's local currency, aggregated in USD, and only converted at display time.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fxRates, toBaseCurrency, CURRENCIES, BASE_CURRENCY } from "@/lib/reference";

type CurrencyContextValue = {
  /** Selected display currency (ISO code). */
  currency: string;
  setCurrency: (c: string) => void;
  /** Convert a USD amount into the display currency. */
  fromUSD: (usd: number) => number;
  /** Format a USD amount in the display currency (e.g. dashboard aggregates). */
  format: (usd: number | null | undefined) => string;
  /** Format an amount stored in some local currency, converted to the display currency. */
  formatLocal: (amount: number | null | undefined, from: string | null | undefined) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = "display-currency";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(BASE_CURRENCY);

  // Restore the persisted choice (defaults to USD until hydrated).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && fxRates[saved]) setCurrencyState(saved);
  }, []);

  function setCurrency(c: string) {
    if (!fxRates[c]) return;
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  }

  const fromUSD = (usd: number) => usd * fxRates[currency];

  function formatValue(value: number): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${currency} ${Math.round(value).toLocaleString()}`;
    }
  }

  const format = (usd: number | null | undefined) =>
    usd == null ? "—" : formatValue(fromUSD(usd));

  const formatLocal = (
    amount: number | null | undefined,
    from: string | null | undefined,
  ) => {
    if (amount == null || !from || !fxRates[from]) return "—";
    return formatValue(fromUSD(toBaseCurrency(amount, from)));
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, fromUSD, format, formatLocal }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}

/** Inline money value: takes a USD amount, renders it in the display currency. */
export function Money({ usd }: { usd: number | null | undefined }) {
  const { format } = useCurrency();
  return <>{format(usd)}</>;
}

const CURRENCY_META: Record<string, { symbol: string; label: string }> = {
  USD: { symbol: "$", label: "US Dollar" },
  GBP: { symbol: "£", label: "British Pound" },
  EUR: { symbol: "€", label: "Euro" },
  INR: { symbol: "₹", label: "Indian Rupee" },
  CAD: { symbol: "C$", label: "Canadian Dollar" },
  AUD: { symbol: "A$", label: "Australian Dollar" },
  SGD: { symbol: "S$", label: "Singapore Dollar" },
  BRL: { symbol: "R$", label: "Brazilian Real" },
};

/** Navbar dropdown for picking the display currency. */
export function CurrencySelect() {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const meta = CURRENCY_META[currency] ?? { symbol: currency, label: currency };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Display currency"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-2.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">
          {meta.symbol}
        </span>
        <span className="font-medium">{currency}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        role="listbox"
        aria-label="Display currency"
        className={`absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg transition-all duration-200 ease-out ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Display currency
        </p>
        <div className="max-h-72 overflow-y-auto p-1">
          {CURRENCIES.map((c) => {
            const m = CURRENCY_META[c] ?? { symbol: c, label: c };
            const active = c === currency;
            return (
              <button
                key={c}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setCurrency(c);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                    active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {m.symbol}
                </span>
                <span className="flex-1">
                  <span className="block font-medium leading-tight">{c}</span>
                  <span className={`block text-xs leading-tight ${active ? "text-brand-500" : "text-slate-400"}`}>
                    {m.label}
                  </span>
                </span>
                {active && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
