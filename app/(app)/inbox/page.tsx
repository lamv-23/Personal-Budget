import { requireSession } from "@/lib/session";
import { getTransactions } from "@/db/queries/transactions";
import { getCategories } from "@/db/queries/categories";
import { db } from "@/db/client";
import { financialAccounts, documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatAUD } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InboxActions } from "@/components/inbox/inbox-actions";

export default async function InboxPage() {
  const session = await requireSession();

  const [pending, categories, accountList] = await Promise.all([
    getTransactions(session.householdId, { status: "pending", limit: 200 }),
    getCategories(session.householdId),
    db.query.financialAccounts.findMany({ where: eq(financialAccounts.householdId, session.householdId) }),
  ]);

  // Group by document
  const grouped = new Map<string | null, typeof pending>();
  for (const tx of pending) {
    const key = tx.documentId ?? null;
    const arr = grouped.get(key) ?? [];
    arr.push(tx);
    grouped.set(key, arr);
  }

  // Load document names
  const docIds = [...grouped.keys()].filter(Boolean) as string[];
  const docMap = new Map<string, string>();
  if (docIds.length > 0) {
    const docs = await db.query.documents.findMany({
      where: (d, { inArray }) => inArray(d.id, docIds),
    });
    for (const d of docs) docMap.set(d.id, d.originalFilename);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          {pending.length} transaction{pending.length !== 1 ? "s" : ""} awaiting review
        </p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm">
              Your inbox is empty. Upload documents on the{" "}
              <a href="/documents" className="text-primary hover:underline">Documents</a> page to extract transactions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([docId, txs]) => (
            <Card key={docId ?? "manual"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {docId ? (docMap.get(docId) ?? "Document") : "Manual entry"}
                  <span className="ml-2 font-normal">({txs.length} transaction{txs.length !== 1 ? "s" : ""})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-0">
                {txs.map((tx) => (
                  <div key={tx.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{tx.description || "Transaction"}</p>
                        {tx.category && (
                          <Badge
                            variant={tx.category.kind === "income" ? "income" : tx.category.kind === "savings" ? "savings" : "expense"}
                            className="text-xs"
                          >
                            {tx.category.name}
                          </Badge>
                        )}
                        {!tx.category && (
                          <Badge variant="pending" className="text-xs">Uncategorised</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.occurredAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold ${tx.amountCents >= 0 ? "text-green-600" : ""}`}>
                        {tx.amountCents >= 0 ? "+" : ""}{formatAUD(tx.amountCents)}
                      </span>
                      <InboxActions
                        txId={tx.id}
                        categories={categories}
                        accounts={accountList}
                        currentCategoryId={tx.categoryId ?? undefined}
                        currentAccountId={tx.accountId ?? undefined}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
