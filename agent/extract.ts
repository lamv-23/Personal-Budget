import { db } from "@/db/client";
import { documents, transactions, extractionRuns, categories, financialAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { geminiProvider } from "./providers/gemini";
import type { ExtractionProvider } from "./provider";
import fs from "fs/promises";
import path from "path";

function getProvider(): ExtractionProvider {
  const name = process.env.EXTRACTION_PROVIDER ?? "gemini";
  if (name === "gemini") return geminiProvider;
  // Add anthropic provider import here when needed
  return geminiProvider;
}

export async function processDocument(documentId: string): Promise<void> {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });
  if (!doc) throw new Error(`Document ${documentId} not found`);
  if (doc.status === "extracted") return;

  // Mark as processing
  await db.update(documents).set({ status: "processing" }).where(eq(documents.id, documentId));

  try {
    // Load household context
    const [cats, accts] = await Promise.all([
      db.query.categories.findMany({
        where: and(eq(categories.householdId, doc.householdId), eq(categories.isArchived, false)),
      }),
      db.query.financialAccounts.findMany({
        where: eq(financialAccounts.householdId, doc.householdId),
      }),
    ]);

    const household = {
      categories: cats.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
      accounts: accts.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
    };

    // Load file
    const uploadDir = process.env.UPLOAD_DIR ?? "/data/uploads";
    const fileBuffer = await fs.readFile(path.join(uploadDir, doc.filePath));

    const provider = getProvider();
    const result = await provider.extract({
      fileBuffer,
      mimeType: doc.mimeType,
      household,
    });

    // Save extraction run
    await db.insert(extractionRuns).values({
      documentId,
      provider: provider.name,
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      promptVersion: "1",
      inputTokens: result.inputTokens ?? null,
      outputTokens: result.outputTokens ?? null,
      rawResponse: result.rawResponse ?? null,
    });

    // Insert pending transactions
    if (result.transactions.length > 0) {
      await db.insert(transactions).values(
        result.transactions.map((t) => ({
          householdId: doc.householdId,
          categoryId: t.suggestedCategoryId ?? null,
          accountId: null,
          amountCents: t.direction === "credit" ? t.amountCents : -t.amountCents,
          occurredAt: t.occurredAt ? new Date(t.occurredAt + "T00:00:00+10:00") : new Date(),
          description: t.description,
          merchant: result.issuer ?? null,
          source: "document" as const,
          documentId,
          createdByUserId: doc.uploadedByUserId,
          status: "pending" as const,
          extractedJson: { confidence: t.confidence, raw: t },
        }))
      );
    }

    // Update document type from extraction result
    await db
      .update(documents)
      .set({
        status: "extracted",
        processedAt: new Date(),
        type: mapDocType(result.documentType),
      })
      .where(eq(documents.id, documentId));
  } catch (err) {
    await db
      .update(documents)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(documents.id, documentId));
    throw err;
  }
}

function mapDocType(t: string): "bill" | "payslip" | "dividend" | "statement" | "other" {
  const map: Record<string, "bill" | "payslip" | "dividend" | "statement" | "other"> = {
    bill: "bill",
    payslip: "payslip",
    dividend: "dividend",
    statement: "statement",
    receipt: "other",
  };
  return map[t] ?? "other";
}
