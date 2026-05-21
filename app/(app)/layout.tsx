import { requireSession } from "@/lib/session";
import { SideNav, MobileNav } from "@/components/nav";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { signOut } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const pendingCount = await db.$count(
    transactions,
    and(
      eq(transactions.householdId, session.householdId),
      eq(transactions.status, "pending")
    )
  );

  return (
    <div className="flex min-h-screen">
      <SideNav
        userName={session.user.name}
        userImage={session.user.image}
        pendingCount={pendingCount}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav userName={session.user.name} pendingCount={pendingCount} />
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
