import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { db } from "@/db/client";
import { budgets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();
  const data = createSchema.parse(body);

  const amountCents = Math.round(parseFloat(data.amount) * 100);
  const monthDate = data.month + "-01";

  // Upsert: delete existing then insert
  await db
    .delete(budgets)
    .where(
      and(
        eq(budgets.householdId, session.householdId),
        eq(budgets.categoryId, data.categoryId),
        eq(budgets.month, monthDate)
      )
    );

  await db.insert(budgets).values({
    householdId: session.householdId,
    categoryId: data.categoryId,
    month: monthDate,
    amountCents,
  });

  return NextResponse.json({ ok: true });
}
