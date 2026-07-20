import { getSalaryRowsForAggregation } from "@/lib/employees";
import { buildDashboard } from "@/lib/analytics";
import { Shell } from "@/components/nav";
import { Stat, Card } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { GroupBarChart, DistributionChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const rows = await getSalaryRowsForAggregation();
  const d = buildDashboard(rows);

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Pay overview</h1>
        <p className="text-sm text-slate-500">
          All figures normalized to USD for cross-country comparison.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Headcount" value={d.headcount.toLocaleString()} />
        <Stat label="Average salary" value={formatMoney(d.overall.avg)} sub="USD, all employees" />
        <Stat label="Median salary" value={formatMoney(d.overall.median)} sub="USD" />
        <Stat label="Payroll (annual)" value={formatMoney(d.overall.sum)} sub="USD, total" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Average salary by country</h2>
          <GroupBarChart data={d.byCountry.map((g) => ({ name: g.group, value: g.avg }))} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Average salary by department</h2>
          <GroupBarChart data={d.byDepartment.map((g) => ({ name: g.group, value: g.avg }))} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Average salary by level</h2>
          <GroupBarChart data={d.byLevel.map((g) => ({ name: g.group, value: g.avg }))} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Salary distribution</h2>
          <DistributionChart data={d.distribution.map((b) => ({ name: b.label, value: b.count }))} />
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Pay bands by level</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-2">Level</th>
                  <th>Count</th>
                  <th>Min</th>
                  <th>Median</th>
                  <th>Avg</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {d.byLevel.map((g) => (
                  <tr key={g.group} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-700">{g.group}</td>
                    <td>{g.count.toLocaleString()}</td>
                    <td>{formatMoney(g.min)}</td>
                    <td>{formatMoney(g.median)}</td>
                    <td>{formatMoney(g.avg)}</td>
                    <td>{formatMoney(g.max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
