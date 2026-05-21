import { requireSession } from "@/lib/session";
import { getTransactions } from "@/db/queries/transactions";
import { getCategories } from "@/db/queries/categories";
import { db } from "@/db/client";
import { financialAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatAUD } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { TransactionActions } from "@/components/transactions/transaction-actions";

export default async function TransactionsPage() {
  const session = await requireSession();
  const [txList, categories, accountList] = await Promise.all([
    getTransactions(session.householdId, { status: "confirmed", limit: 200 }),
    getCategories(session.householdId),
    db.query.financialAccounts.findMany({ where: eq(financialAccounts.householdId, session.householdId) }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm">{txList.length} confirmed transactions</p>
        </div>
        <AddTransactionButton
          categories={categories}
          accounts={accountList}
          userId={session.user.id}
          householdId={session.householdId}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {txList.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No transactions yet. Add one manually or upload a document.
            </div>
          ) : (
            <div className="divide-y">
              {txList.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    style={{ backgroundColor: tx.category?.color ?? "#6b7280" }}
                  >
                    {tx.category?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || tx.merchant || "Transaction"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(tx.occurredAt)}</span>
                      {tx.category && (
                        <Badge
                          variant={tx.category.kind === "income" ? "income" : tx.category.kind === "savings" ? "savings" : "expense"}
                          className="text-xs"
                        >
                          {tx.category.name}
                        </Badge>
                      )}
                      {tx.account && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">{tx.account.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-semibold ${tx.amountCents >= 0 ? "text-green-600" : "text-foreground"}`}>
                      {tx.amountCents >= 0 ? "+" : ""}{formatAUD(tx.amountCents)}
                    </span>
                    <TransactionActions txId={tx.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
