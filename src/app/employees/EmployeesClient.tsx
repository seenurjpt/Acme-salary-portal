"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select, Card, Badge, Spinner, Label } from "@/components/ui";
import { useCurrency } from "@/components/currency";
import { EmployeeDialog } from "./EmployeeDialog";

type Row = {
  id: string;
  name: string;
  email: string;
  country: string;
  department: string;
  jobTitle: string;
  level: string;
  hireDate: string;
  salary: number | null;
  currency: string | null;
};

type Props = {
  countries: string[];
  departments: string[];
  levels: string[];
  currencies: string[];
};

export function EmployeesClient({ countries, departments, levels, currencies }: Props) {
  const { formatLocal } = useCurrency();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (country) params.set("country", country);
    if (department) params.set("department", department);
    if (level) params.set("level", level);
    params.set("page", String(page));
    const res = await fetch(`/api/employees?${params}`);
    const data = await res.json();
    setRows(data.items);
    setTotal(data.total);
    setPageSize(data.pageSize);
    setLoading(false);
  }, [search, country, department, level, page]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [search, country, department, level]);

  useEffect(() => {
    const t = setTimeout(load, 200); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(id: string) {
    setEditing(id);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">{total.toLocaleString()} matching records</p>
        </div>
        <Button onClick={openAdd}>+ Add employee</Button>
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-1">
            <Label>Search</Label>
            <Input
              placeholder="Name, email, title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label>Country</Label>
            <Select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">All</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Department</Label>
            <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Level</Label>
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All</option>
              {levels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No employees match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4">Title</th>
                  <th className="px-4">Country</th>
                  <th className="px-4">Dept</th>
                  <th className="px-4">Level</th>
                  <th className="px-4">Salary</th>
                  <th className="px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.email}</div>
                    </td>
                    <td className="px-4 text-slate-600">{r.jobTitle}</td>
                    <td className="px-4 text-slate-600">{r.country}</td>
                    <td className="px-4 text-slate-600">{r.department}</td>
                    <td className="px-4"><Badge>{r.level}</Badge></td>
                    <td className="px-4 font-medium text-slate-800">
                      {formatLocal(r.salary, r.currency)}
                    </td>
                    <td className="px-4 text-right">
                      <button
                        onClick={() => openEdit(r.id)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} · {total.toLocaleString()} employees ({pageSize} per page)
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {dialogOpen && (
        <EmployeeDialog
          employeeId={editing}
          countries={countries}
          departments={departments}
          levels={levels}
          currencies={currencies}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
