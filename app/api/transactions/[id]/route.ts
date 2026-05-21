import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;
  const body = await req.json();
  await db
    .update(transactions)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.householdId, session.householdId)));
  return NextResponse.json({ ok: true });
}
