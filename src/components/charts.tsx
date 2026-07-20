"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCurrency } from "./currency";

type Datum = { name: string; value: number };
type BucketDatum = { min: number; max: number; count: number };

/** Compact money tick, converted to the display currency: 70200 -> "$70k" / "₹5.8M". */
function useMoneyTick() {
  const { currency, fromUSD } = useCurrency();
  return (usd: number) => {
    const v = fromUSD(usd);
    const compact = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    });
    try {
      return compact.format(v);
    } catch {
      return `${Math.round(v / 1000)}k`;
    }
  };
}

export function GroupBarChart({ data }: { data: Datum[] }) {
  const { format } = useCurrency();
  const tick = useMoneyTick();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tickFormatter={tick} tick={{ fontSize: 11 }} width={56} />
        <Tooltip formatter={(v: number) => [format(v), "Avg"]} />
        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DistributionChart({ data }: { data: BucketDatum[] }) {
  const tick = useMoneyTick();
  // Bucket edges are USD; label them in the display currency.
  const chartData = data.map((b) => ({
    name: `${tick(b.min)}–${tick(b.max)}`,
    value: b.count,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v.toLocaleString(), "Employees"]} />
        <Bar dataKey="value" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
