import { NextResponse } from "next/server";
import { getSalaryRowsForAggregation } from "@/lib/employees";
import { buildDashboard } from "@/lib/analytics";
import { requireActor, unauthorized } from "@/lib/api-helpers";

export async function GET() {
  const actor = await requireActor();
  if (!actor) return unauthorized();

  const rows = await getSalaryRowsForAggregation();
  const dashboard = buildDashboard(rows);
  return NextResponse.json(dashboard);
}
