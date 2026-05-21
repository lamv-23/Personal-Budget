import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { z } from "zod";

const createSchema = z.object({
  description: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  direction: z.enum(["expense", "income", "savings"]),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal("")),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();
  const data = createSchema.parse(body);

  const amountCents = Math.round(parseFloat(data.amount) * 100);
  // Sign: income = positive, expense/savings = negative
  const signedCents = data.direction === "income" ? amountCents : -amountCents;

  await db.insert(transactions).values({
    householdId: session.householdId,
    categoryId: data.categoryId || null,
    accountId: data.accountId || null,
    amountCents: signedCents,
    occurredAt: new Date(data.occurredAt + "T00:00:00+10:00"),
    description: data.description,
    source: "manual",
    status: "confirmed",
    createdByUserId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
