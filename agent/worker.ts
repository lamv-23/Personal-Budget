import PgBoss from "pg-boss";
import { processDocument } from "./extract";

let boss: PgBoss | null = null;

export async function startWorker() {
  if (boss) return;

  boss = new PgBoss(process.env.DATABASE_URL!);

  boss.on("error", (err) => {
    console.error("[pg-boss]", err);
  });

  await boss.start();

  await boss.work<{ documentId: string }>("document.extract", async (jobs) => {
    for (const job of jobs) {
      const { documentId } = job.data;
      console.log(`[worker] processing document ${documentId}`);
      await processDocument(documentId);
      console.log(`[worker] done ${documentId}`);
    }
  });

  console.log("[worker] pg-boss started, listening for document.extract jobs");
}

export async function enqueueDocumentExtraction(documentId: string) {
  if (!boss) {
    console.warn("[worker] boss not started, processing inline");
    await processDocument(documentId);
    return;
  }
  await boss.send("document.extract", { documentId });
}

export function getBoss() {
  return boss;
}
