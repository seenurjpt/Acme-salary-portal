import { NextResponse } from "next/server";
import { auth } from "@/auth";

/** Returns the authenticated actor's email, or null if unauthenticated. */
export async function requireActor(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** True when a thrown error is Prisma's unique-constraint violation (P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}
