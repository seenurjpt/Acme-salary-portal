/**
 * Employee data-access + service layer.
 *
 * Wraps Prisma with the app's business rules: current-salary joins, soft-delete,
 * pagination/filtering over 10k rows (done DB-side), and audit logging on every mutation.
 */

import { prisma } from "./prisma";
import type { SalaryRow } from "./aggregation";

export type EmployeeFilter = {
  search?: string;
  country?: string;
  department?: string;
  level?: string;
};

export type EmployeeListItem = {
  id: string;
  name: string;
  email: string;
  country: string;
  department: string;
  jobTitle: string;
  level: string;
  hireDate: Date;
  salary: number | null;
  currency: string | null;
};

const PAGE_SIZE = 25;

function buildWhere(filter: EmployeeFilter) {
  const where: Record<string, unknown> = { isActive: true };
  if (filter.country) where.country = filter.country;
  if (filter.department) where.department = filter.department;
  if (filter.level) where.level = filter.level;
  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search } },
      { email: { contains: filter.search } },
      { jobTitle: { contains: filter.search } },
    ];
  }
  return where;
}

export async function listEmployees(
  filter: EmployeeFilter,
  page = 1,
  pageSize = PAGE_SIZE,
): Promise<{ items: EmployeeListItem[]; total: number; page: number; pageSize: number }> {
  const where = buildWhere(filter);
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { salaries: { where: { isCurrent: true }, take: 1 } },
    }),
    prisma.employee.count({ where }),
  ]);

  const items: EmployeeListItem[] = rows.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    country: e.country,
    department: e.department,
    jobTitle: e.jobTitle,
    level: e.level,
    hireDate: e.hireDate,
    salary: e.salaries[0]?.amount ?? null,
    currency: e.salaries[0]?.currency ?? null,
  }));

  return { items, total, page, pageSize };
}

export async function getEmployee(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    include: { salaries: { orderBy: { effectiveDate: "desc" } } },
  });
}

/** All current salary rows in the minimal shape the aggregation engine needs. */
export async function getSalaryRowsForAggregation(): Promise<SalaryRow[]> {
  const rows = await prisma.salaryRecord.findMany({
    where: { isCurrent: true, employee: { isActive: true } },
    select: {
      amount: true,
      currency: true,
      employee: { select: { country: true, department: true, level: true } },
    },
  });
  return rows.map((r) => ({
    amount: r.amount,
    currency: r.currency,
    country: r.employee.country,
    department: r.employee.department,
    level: r.employee.level,
  }));
}

async function writeAudit(
  entity: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown,
  actor: string,
) {
  await prisma.auditLog.create({
    data: {
      entity,
      entityId,
      action,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      actor,
    },
  });
}

export type CreateEmployeeInput = {
  name: string;
  email: string;
  country: string;
  department: string;
  jobTitle: string;
  level: string;
  hireDate: Date;
  salary: number;
  currency: string;
};

export async function createEmployee(input: CreateEmployeeInput, actor: string) {
  const employee = await prisma.employee.create({
    data: {
      name: input.name,
      email: input.email,
      country: input.country,
      department: input.department,
      jobTitle: input.jobTitle,
      level: input.level,
      hireDate: input.hireDate,
      salaries: {
        create: {
          amount: input.salary,
          currency: input.currency,
          effectiveDate: input.hireDate,
          isCurrent: true,
        },
      },
    },
    include: { salaries: true },
  });
  await writeAudit("Employee", employee.id, "create", null, employee, actor);
  return employee;
}

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, "salary" | "currency">> & {
  salary?: number;
  currency?: string;
};

/**
 * Update employee fields and, if salary/currency changed, close the current salary record
 * and open a new one (history preserved — no destructive overwrite).
 */
export async function updateEmployee(id: string, input: UpdateEmployeeInput, actor: string) {
  const before = await getEmployee(id);
  if (!before) throw new Error("Employee not found");

  const employee = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        country: input.country,
        department: input.department,
        jobTitle: input.jobTitle,
        level: input.level,
        hireDate: input.hireDate,
      },
    });

    const current = before.salaries.find((s) => s.isCurrent);
    const salaryChanged =
      (input.salary != null && input.salary !== current?.amount) ||
      (input.currency != null && input.currency !== current?.currency);

    if (salaryChanged) {
      if (current) {
        await tx.salaryRecord.update({ where: { id: current.id }, data: { isCurrent: false } });
      }
      await tx.salaryRecord.create({
        data: {
          employeeId: id,
          amount: input.salary ?? current?.amount ?? 0,
          currency: input.currency ?? current?.currency ?? "USD",
          effectiveDate: new Date(),
          isCurrent: true,
        },
      });
    }

    return tx.employee.findUnique({ where: { id }, include: { salaries: true } });
  });

  await writeAudit("Employee", id, "update", before, employee, actor);
  return employee;
}

/** Soft-delete: mark inactive so history/audit stays intact. */
export async function deleteEmployee(id: string, actor: string) {
  const before = await prisma.employee.findUnique({ where: { id } });
  if (!before) throw new Error("Employee not found");
  await prisma.employee.update({ where: { id }, data: { isActive: false } });
  await writeAudit("Employee", id, "delete", before, null, actor);
}
