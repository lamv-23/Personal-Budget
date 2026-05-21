import { requireSession } from "@/lib/session";
import { getMonthlySeriesFor12Months, getMonthlyCategoryTotals } from "@/db/queries/transactions";
import { last12MonthStarts, currentMonthStart, currentMonthEnd } from "@/lib/dates";
import { formatAUD } from "@/lib/money";
import { endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/charts/overview-chart";
import { CategoryPieChart } from "@/components/charts/category-pie-chart";

export default async function TrendsPage() {
  const session = await requireSession();
  const months = last12MonthStarts();
  const monthRanges = months.map((m) => ({
    from: m.date,
    to: endOfMonth(m.date),
    label: m.label,
  }));

  const from = currentMonthStart();
  const to = currentMonthEnd();

  const [chartData, expenseCategories, incomeCategories] = await Promise.all([
    getMonthlySeriesFor12Months(session.householdId, monthRanges),
    getMonthlyCategoryTotals(session.householdId, from, to, "expense"),
    getMonthlyCategoryTotals(session.householdId, from, to, "income"),
  ]);

  const totalIncome = chartData.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = chartData.reduce((sum, m) => sum + m.expense, 0);
  const totalSavings = chartData.reduce((sum, m) => sum + m.savings, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trends</h1>
        <p className="text-muted-foreground text-sm">Last 12 months</p>
      </div>

      {/* 12-month summary */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">12M Income</p>
            <p className="text-xl font-bold text-green-600">{formatAUD(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">12M Expenses</p>
            <p className="text-xl font-bold text-red-500">{formatAUD(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">12M Savings</p>
            <p className="text-xl font-bold text-blue-600">{formatAUD(totalSavings)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Cash Flow — Last 12 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <OverviewChart data={chartData} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This Month — Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart
              data={expenseCategories.map((c) => ({
                name: c.categoryName ?? "Uncategorised",
                value: Math.abs(c.total ?? 0),
                color: c.categoryColor ?? "#6b7280",
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">This Month — Income by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart
              data={incomeCategories.map((c) => ({
                name: c.categoryName ?? "Uncategorised",
                value: Math.abs(c.total ?? 0),
                color: c.categoryColor ?? "#6b7280",
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
