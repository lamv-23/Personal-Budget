import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  kind: z.enum(["income", "expense", "savings"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();
  const data = createSchema.parse(body);

  await db.insert(categories).values({
    householdId: session.householdId,
    name: data.name,
    kind: data.kind,
    color: data.color,
  });

  return NextResponse.json({ ok: true });
}
