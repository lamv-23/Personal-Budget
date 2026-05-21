import { auth } from "./auth";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { householdMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

export type AppSession = {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  householdId: string;
};

export async function requireSession(): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const s = session as typeof session & { householdId?: string };
  if (s.householdId) {
    return { user: session.user as AppSession["user"], householdId: s.householdId };
  }

  // Fallback: look up household from DB
  const membership = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, session.user.id!),
  });
  if (!membership) redirect("/signin");

  return {
    user: session.user as AppSession["user"],
    householdId: membership.householdId,
  };
}
