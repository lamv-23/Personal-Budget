import { db } from "./client";
import { categories, financialAccounts } from "./schema";

const DEFAULT_CATEGORIES = [
  // Expenses — Standard household
  { name: "Groceries", kind: "expense" as const, color: "#16a34a" },
  { name: "Utilities", kind: "expense" as const, color: "#0891b2" },
  { name: "Rent / Mortgage", kind: "expense" as const, color: "#7c3aed" },
  { name: "Transport", kind: "expense" as const, color: "#d97706" },
  { name: "Dining Out", kind: "expense" as const, color: "#dc2626" },
  { name: "Subscriptions", kind: "expense" as const, color: "#db2777" },
  { name: "Healthcare", kind: "expense" as const, color: "#059669" },
  { name: "Insurance", kind: "expense" as const, color: "#0284c7" },
  // Expenses — Kids & family
  { name: "Childcare", kind: "expense" as const, color: "#f59e0b" },
  { name: "School Fees", kind: "expense" as const, color: "#84cc16" },
  { name: "Kids' Activities", kind: "expense" as const, color: "#14b8a6" },
  { name: "Clothing", kind: "expense" as const, color: "#a855f7" },
  // Expenses — Other
  { name: "Vet", kind: "expense" as const, color: "#f97316" },
  { name: "Holiday", kind: "expense" as const, color: "#06b6d4" },
  { name: "Home & Garden", kind: "expense" as const, color: "#65a30d" },
  { name: "Entertainment", kind: "expense" as const, color: "#e11d48" },
  // Income
  { name: "Salary", kind: "income" as const, color: "#2563eb" },
  { name: "Dividends", kind: "income" as const, color: "#16a34a" },
  { name: "Interest", kind: "income" as const, color: "#0891b2" },
  { name: "Rental Income", kind: "income" as const, color: "#7c3aed" },
  { name: "Other Income", kind: "income" as const, color: "#6b7280" },
  // Savings
  { name: "Savings Transfer", kind: "savings" as const, color: "#2563eb" },
  { name: "Super Contribution", kind: "savings" as const, color: "#7c3aed" },
  { name: "Shares / ETFs", kind: "savings" as const, color: "#0891b2" },
];

const DEFAULT_ACCOUNTS = [
  { name: "Joint Transaction Account", kind: "bank" as const },
  { name: "Joint Savings Account", kind: "bank" as const },
  { name: "Credit Card", kind: "bank" as const },
  { name: "Super", kind: "super" as const },
];

export async function seedHousehold(householdId: string) {
  const existingCategories = await db.query.categories.findMany({
    where: (c, { eq }) => eq(c.householdId, householdId),
    limit: 1,
  });
  if (existingCategories.length > 0) return;

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, householdId }))
  );

  await db.insert(financialAccounts).values(
    DEFAULT_ACCOUNTS.map((a) => ({ ...a, householdId }))
  );
}
