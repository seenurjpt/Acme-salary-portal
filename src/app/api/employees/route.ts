import { NextRequest, NextResponse } from "next/server";
import { listEmployees, createEmployee } from "@/lib/employees";
import { createEmployeeSchema } from "@/lib/validators";
import { requireActor, unauthorized, badRequest } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const actor = await requireActor();
  if (!actor) return unauthorized();

  const p = req.nextUrl.searchParams;
  const result = await listEmployees(
    {
      search: p.get("search") ?? undefined,
      country: p.get("country") ?? undefined,
      department: p.get("department") ?? undefined,
      level: p.get("level") ?? undefined,
    },
    Math.max(1, Number(p.get("page") ?? 1)),
  );
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const employee = await createEmployee(parsed.data, actor);
  return NextResponse.json(employee, { status: 201 });
}
