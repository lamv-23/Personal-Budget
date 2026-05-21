import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { db } from "@/db/client";
import { documents } from "@/db/schema";
import { enqueueDocumentExtraction } from "@/agent/worker";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Please upload a PDF or image." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 400 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "/data/uploads";
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const filename = `${session.householdId}/${randomUUID()}.${ext}`;
  const fullPath = path.join(uploadDir, filename);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const bytes = await file.arrayBuffer();
  await fs.writeFile(fullPath, Buffer.from(bytes));

  const [doc] = await db
    .insert(documents)
    .values({
      householdId: session.householdId,
      uploadedByUserId: session.user.id,
      filePath: filename,
      mimeType: file.type,
      originalFilename: file.name,
      status: "uploaded",
    })
    .returning();

  // Enqueue for AI extraction (don't await — fire and forget)
  enqueueDocumentExtraction(doc.id).catch((err) => {
    console.error("[upload] failed to enqueue", err);
  });

  return NextResponse.json({ ok: true, documentId: doc.id });
}
