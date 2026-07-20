"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select, Label } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/format";

type Props = {
  employeeId: string | null;
  countries: string[];
  departments: string[];
  levels: string[];
  currencies: string[];
  onClose: () => void;
  onSaved: () => void;
};

type Form = {
  name: string;
  email: string;
  country: string;
  department: string;
  jobTitle: string;
  level: string;
  hireDate: string;
  salary: string;
  currency: string;
};

type SalaryHistory = { id: string; amount: number; currency: string; effectiveDate: string; isCurrent: boolean };

const empty = (countries: string[], departments: string[], levels: string[], currencies: string[]): Form => ({
  name: "",
  email: "",
  country: countries[0],
  department: departments[0],
  jobTitle: "",
  level: levels[0],
  hireDate: new Date().toISOString().slice(0, 10),
  salary: "",
  currency: currencies[0],
});

export function EmployeeDialog({
  employeeId,
  countries,
  departments,
  levels,
  currencies,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!employeeId;
  const [form, setForm] = useState<Form>(empty(countries, departments, levels, currencies));
  const [history, setHistory] = useState<SalaryHistory[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      const res = await fetch(`/api/employees/${employeeId}`);
      const e = await res.json();
      const current = e.salaries?.find((s: SalaryHistory) => s.isCurrent) ?? e.salaries?.[0];
      setForm({
        name: e.name,
        email: e.email,
        country: e.country,
        department: e.department,
        jobTitle: e.jobTitle,
        level: e.level,
        hireDate: e.hireDate.slice(0, 10),
        salary: current ? String(current.amount) : "",
        currency: current?.currency ?? currencies[0],
      });
      setHistory(e.salaries ?? []);
      setLoading(false);
    })();
  }, [employeeId, currencies]);

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      salary: Number(form.salary),
      hireDate: form.hireDate,
    };
    const res = await fetch(isEdit ? `/api/employees/${employeeId}` : "/api/employees", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!employeeId || !confirm("Remove this employee? Their record is soft-deleted and stays auditable.")) return;
    setSaving(true);
    await fetch(`/api/employees/${employeeId}`, { method: "DELETE" });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {isEdit ? "Edit employee" : "Add employee"}
        </h2>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" />
              </div>
              <div>
                <Label>Job title</Label>
                <Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
              </div>
              <div>
                <Label>Level</Label>
                <Select value={form.level} onChange={(e) => set("level", e.target.value)}>
                  {levels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Country</Label>
                <Select value={form.country} onChange={(e) => set("country", e.target.value)}>
                  {countries.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.department} onChange={(e) => set("department", e.target.value)}>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Hire date</Label>
                <Input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Salary</Label>
                  <Input
                    type="number"
                    value={form.salary}
                    onChange={(e) => set("salary", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                    {currencies.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            {isEdit && history.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Salary history</p>
                <div className="space-y-1">
                  {history.map((h) => (
                    <div key={h.id} className="flex justify-between text-sm">
                      <span className="text-slate-500">{formatDate(h.effectiveDate)}</span>
                      <span className={h.isCurrent ? "font-medium text-slate-800" : "text-slate-400"}>
                        {formatMoney(h.amount, h.currency)} {h.isCurrent && "(current)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              {isEdit ? (
                <Button variant="danger" onClick={remove} disabled={saving}>
                  Remove
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
