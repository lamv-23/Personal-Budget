import { requireSession } from "@/lib/session";
import { getBudgetsWithSpend } from "@/db/queries/budgets";
import { getCategories } from "@/db/queries/categories";
import { currentMonthStart, currentMonthEnd, formatMonth } from "@/lib/dates";
import { formatAUD } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SetBudgetButton } from "@/components/budgets/set-budget-button";

export default async function BudgetsPage() {
  const session = await requireSession();
  const from = currentMonthStart();
  const to = currentMonthEnd();

  const [budgets, categories] = await Promise.all([
    getBudgetsWithSpend(session.householdId, from, to),
    getCategories(session.householdId),
  ]);

  const monthLabel = formatMonth(from);
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amountCents, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.actualCents, 0);
  const overBudget = budgets.filter((b) => b.isOverBudget);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground text-sm">{monthLabel}</p>
        </div>
        <SetBudgetButton
          categories={expenseCategories}
          householdId={session.householdId}
          month={from.toISOString().split("T")[0].substring(0, 7)}
        />
      </div>

      {/* Summary */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Budgeted</p>
            <p className="text-xl font-bold">{formatAUD(totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Spent</p>
            <p className={`text-xl font-bold ${totalSpent > totalBudgeted ? "text-red-500" : ""}`}>
              {formatAUD(totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Remaining</p>
            <p className={`text-xl font-bold ${totalBudgeted - totalSpent < 0 ? "text-red-500" : "text-green-600"}`}>
              {formatAUD(totalBudgeted - totalSpent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {overBudget.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>{overBudget.length} categor{overBudget.length === 1 ? "y" : "ies"} over budget:</strong>{" "}
          {overBudget.map((b) => b.category?.name).join(", ")}
        </div>
      )}

      {/* Budget rows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Budgets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {budgets.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No budgets set for {monthLabel}. Click &quot;Set Budget&quot; to add one.
            </div>
          ) : (
            budgets
              .sort((a, b) => b.amountCents - a.amountCents)
              .map((b) => (
                <div key={b.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: b.category?.color ?? "#6b7280" }}
                      />
                      <span className="text-sm font-medium">{b.category?.name}</span>
                      {b.isOverBudget && (
                        <Badge variant="destructive" className="text-xs">Over budget</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${b.isOverBudget ? "text-red-500" : ""}`}>
                        {formatAUD(b.actualCents)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">/ {formatAUD(b.amountCents)}</span>
                    </div>
                  </div>
                  <Progress
                    value={b.percentUsed}
                    className={
                      b.isOverBudget
                        ? "[&>div]:bg-red-500"
                        : b.percentUsed > 85
                        ? "[&>div]:bg-orange-500"
                        : b.percentUsed > 60
                        ? "[&>div]:bg-yellow-500"
                        : ""
                    }
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {formatAUD(Math.max(0, b.amountCents - b.actualCents))} remaining ({b.percentUsed}% used)
                  </p>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
