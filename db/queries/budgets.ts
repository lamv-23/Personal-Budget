import { db } from "../client";
import { budgets, categories, transactions } from "../schema";
import { eq, and, gte, lte, sum } from "drizzle-orm";
import { format } from "date-fns";

export async function getBudgetsWithSpend(householdId: string, from: Date, to: Date) {
  const monthStr = format(from, "yyyy-MM-01");

  const budgetRows = await db.query.budgets.findMany({
    where: and(eq(budgets.householdId, householdId), eq(budgets.month, monthStr)),
    with: { category: true },
  });

  if (budgetRows.length === 0) return [];

  // Get actuals for budgeted categories
  const actuals = await db
    .select({
      categoryId: transactions.categoryId,
      total: sum(transactions.amountCents).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.status, "confirmed"),
        gte(transactions.occurredAt, from),
        lte(transactions.occurredAt, to)
      )
    )
    .groupBy(transactions.categoryId);

  const actualMap = new Map(actuals.map((a) => [a.categoryId, a.total ?? 0]));

  return budgetRows.map((b) => {
    const actual = Math.abs(actualMap.get(b.categoryId) ?? 0);
    const pct = b.amountCents > 0 ? Math.min((actual / b.amountCents) * 100, 100) : 0;
    return {
      ...b,
      actualCents: actual,
      percentUsed: Math.round(pct),
      isOverBudget: actual > b.amountCents,
    };
  });
}

export type BudgetWithSpend = Awaited<ReturnType<typeof getBudgetsWithSpend>>[number];
