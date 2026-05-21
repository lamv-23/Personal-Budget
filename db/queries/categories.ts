import { db } from "../client";
import { categories } from "../schema";
import { eq, and } from "drizzle-orm";

export async function getCategories(householdId: string) {
  return db.query.categories.findMany({
    where: and(eq(categories.householdId, householdId), eq(categories.isArchived, false)),
    orderBy: (c, { asc }) => [asc(c.kind), asc(c.name)],
  });
}

export type Category = Awaited<ReturnType<typeof getCategories>>[number];
