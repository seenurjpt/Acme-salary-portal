import { NextRequest, NextResponse } from "next/server";
import { getEmployee, updateEmployee, deleteEmployee } from "@/lib/employees";
import { updateEmployeeSchema } from "@/lib/validators";
import { requireActor, unauthorized, badRequest, conflict, isUniqueViolation } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  if (!actor) return unauthorized();
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  if (!actor) return unauthorized();
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  }

  try {
    const employee = await updateEmployee(id, parsed.data, actor);
    return NextResponse.json(employee);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return conflict("Another employee already uses this email.");
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    await deleteEmployee(id, actor);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
