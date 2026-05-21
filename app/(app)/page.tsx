import { requireSession } from "@/lib/session";
import { getMonthlyTotals, getMonthlyCategoryTotals, getTransactions, getMonthlySeriesFor12Months } from "@/db/queries/transactions";
import { getBudgetsWithSpend } from "@/db/queries/budgets";
import { currentMonthStart, currentMonthEnd, last12MonthStarts, endOfMonth } from "@/lib/dates";
import { formatAUD, formatAUDCompact } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import { OverviewChart } from "@/components/charts/overview-chart";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { getCategories } from "@/db/queries/categories";
import { db } from "@/db/client";
import { financialAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { endOfMonth as dfEndOfMonth } from "date-fns";
import { formatDate } from "@/lib/dates";

export default async function OverviewPage() {
  const session = await requireSession();
  const from = currentMonthStart();
  const to = currentMonthEnd();

  const [totals, budgets, recentTx, categories, accountList, months] = await Promise.all([
    getMonthlyTotals(session.householdId, from, to),
    getBudgetsWithSpend(session.householdId, from, to),
    getTransactions(session.householdId, { status: "confirmed", limit: 8 }),
    getCategories(session.householdId),
    db.query.financialAccounts.findMany({
      where: eq(financialAccounts.householdId, session.householdId),
    }),
    Promise.resolve(last12MonthStarts()),
  ]);

  const monthRanges = months.map((m) => ({
    from: m.date,
    to: dfEndOfMonth(m.date),
    label: m.label,
  }));
  const chartData = await getMonthlySeriesFor12Months(session.householdId, monthRanges);

  const net = totals.income - totals.expense - totals.savings;
  const topBudgets = budgets.sort((a, b) => b.percentUsed - a.percentUsed).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleString("en-AU", { month: "long", year: "numeric", timeZone: "Australia/Sydney" })}
          </p>
        </div>
        <AddTransactionButton categories={categories} accounts={accountList} userId={session.user.id} householdId={session.householdId} />
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Income"
          value={formatAUDCompact(totals.income)}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          color="text-green-600"
        />
        <KPICard
          title="Expenses"
          value={formatAUDCompact(totals.expense)}
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          color="text-red-500"
        />
        <KPICard
          title="Savings"
          value={formatAUDCompact(totals.savings)}
          icon={<PiggyBank className="h-4 w-4 text-blue-600" />}
          color="text-blue-600"
        />
        <KPICard
          title="Net Cash Flow"
          value={formatAUDCompact(net)}
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          color={net >= 0 ? "text-green-600" : "text-red-500"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 6-month chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">12-Month Cash Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <OverviewChart data={chartData} />
            </CardContent>
          </Card>
        </div>

        {/* Budget progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Budget Progress</CardTitle>
              <Link href="/budgets" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {topBudgets.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                <Link href="/budgets" className="text-primary hover:underline">Set up budgets</Link> to track spending
              </div>
            ) : (
              topBudgets.map((b) => (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{b.category?.name}</span>
                    <span className={b.isOverBudget ? "text-red-500 text-xs font-medium" : "text-muted-foreground text-xs"}>
                      {formatAUD(b.actualCents)} / {formatAUD(b.amountCents)}
                    </span>
                  </div>
                  <Progress
                    value={b.percentUsed}
                    className={b.isOverBudget ? "[&>div]:bg-red-500" : b.percentUsed > 80 ? "[&>div]:bg-orange-500" : ""}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No transactions yet. <Link href="/documents" className="text-primary hover:underline">Upload a document</Link> or add one manually.
            </p>
          ) : (
            <div className="space-y-1">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-accent/50 transition-colors">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                    style={{ backgroundColor: tx.category?.color ?? "#6366f1" }}
                  >
                    {tx.category?.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.merchant || "Transaction"}</p>
                    <p className="text-xs text-muted-foreground">{tx.category?.name ?? "Uncategorised"} · {formatDate(tx.occurredAt)}</p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${tx.amountCents >= 0 ? "text-green-600" : "text-foreground"}`}>
                    {tx.amountCents >= 0 ? "+" : ""}{formatAUD(tx.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          {icon}
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
