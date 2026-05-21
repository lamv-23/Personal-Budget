import { db } from "../client";
import { transactions, categories, financialAccounts } from "../schema";
import { eq, and, gte, lte, desc, sum, sql } from "drizzle-orm";

export async function getTransactions(
  householdId: string,
  opts: { status?: "confirmed" | "pending" | "rejected"; limit?: number; offset?: number } = {}
) {
  const conditions = [
    eq(transactions.householdId, householdId),
    ...(opts.status ? [eq(transactions.status, opts.status)] : []),
  ];

  return db.query.transactions.findMany({
    where: and(...conditions),
    with: {
      category: true,
      account: true,
    },
    orderBy: [desc(transactions.occurredAt), desc(transactions.createdAt)],
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
  });
}

export async function getMonthlyTotals(householdId: string, from: Date, to: Date) {
  const rows = await db
    .select({
      kind: categories.kind,
      total: sum(transactions.amountCents).mapWith(Number),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.householdId, householdId),
        eq(transactions.status, "confirmed"),
        gte(transactions.occurredAt, from),
        lte(transactions.occurredAt, to)
      )
    )
    .groupBy(categories.kind);

  const result = { income: 0, expense: 0, savings: 0, uncategorised: 0 };
  for (const row of rows) {
    if (row.kind === "income") result.income += row.total ?? 0;
    else if (row.kind === "expense") result.expense += Math.abs(row.total ?? 0);
    else if (row.kind === "savings") result.savings += row.total ?? 0;
    else result.uncategorised += row.total ?? 0;
  }
  return result;
}

export async function getMonthlyCategoryTotals(
  householdId: string,
  from: Date,
  to: Date,
  kind?: "income" | "expense" | "savings"
) {
  const conditions = [
    eq(transactions.householdId, householdId),
    eq(transactions.status, "confirmed"),
    gte(transactions.occurredAt, from),
    lte(transactions.occurredAt, to),
    ...(kind ? [eq(categories.kind, kind)] : []),
  ];

  return db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryKind: categories.kind,
      total: sum(transactions.amountCents).mapWith(Number),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(...conditions))
    .groupBy(
      transactions.categoryId,
      categories.name,
      categories.color,
      categories.kind
    )
    .orderBy(sql`abs(sum(${transactions.amountCents})) desc`);
}

export async function getMonthlySeriesFor12Months(
  householdId: string,
  months: Array<{ from: Date; to: Date; label: string }>
) {
  return Promise.all(
    months.map(async ({ from, to, label }) => {
      const totals = await getMonthlyTotals(householdId, from, to);
      return { label, ...totals };
    })
  );
}

export type TransactionWithRelations = Awaited<ReturnType<typeof getTransactions>>[number];
