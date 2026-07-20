import { NextRequest, NextResponse } from "next/server";
import { getSalaryRowsForAggregation, findEmployeesByName } from "@/lib/employees";
import { runIntent, runLookup } from "@/lib/analytics";
import { translateQuestion } from "@/lib/ai";
import { askSchema } from "@/lib/validators";
import { requireActor, unauthorized, badRequest } from "@/lib/api-helpers";

/**
 * Natural-language pay Q&A.
 * question → translate to QueryIntent (AI or local) → validate → run through the SAME
 * aggregation engine the dashboard uses. Read-only; the intent is whitelisted so nothing
 * arbitrary reaches the data.
 */
export async function POST(req: NextRequest) {
  const actor = await requireActor();
  if (!actor) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) return badRequest("A question is required.");

  const translation = await translateQuestion(parsed.data.question);
  if (!translation.ok) {
    return NextResponse.json({ error: translation.error }, { status: 422 });
  }

  if (translation.intent.kind === "lookup") {
    const matches = await findEmployeesByName(translation.intent.name, translation.intent.filter);
    const answer = runLookup(translation.intent, matches);
    return NextResponse.json({ ...answer, source: translation.source });
  }

  const rows = await getSalaryRowsForAggregation();
  const answer = runIntent(rows, translation.intent);
  return NextResponse.json({ ...answer, source: translation.source });
}
