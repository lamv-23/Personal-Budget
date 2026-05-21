import { requireSession } from "@/lib/session";
import { db } from "@/db/client";
import { documents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dropzone } from "@/components/upload/dropzone";
import { FileText, FileScan, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

const statusIcon = {
  uploaded: <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />,
  processing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  extracted: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
};

const statusLabel = {
  uploaded: "Queued",
  processing: "Processing",
  extracted: "Done",
  failed: "Failed",
};

export default async function DocumentsPage() {
  const session = await requireSession();
  const docs = await db.query.documents.findMany({
    where: eq(documents.householdId, session.householdId),
    orderBy: [desc(documents.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm">Upload financial documents to extract transactions automatically</p>
      </div>

      <Dropzone />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uploaded Documents ({docs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No documents uploaded yet. Drop a file above to get started.
            </div>
          ) : (
            <div className="divide-y">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.originalFilename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
                      <Badge variant="outline" className="text-xs capitalize">{doc.type}</Badge>
                      {doc.status === "failed" && doc.error && (
                        <span className="text-xs text-destructive truncate max-w-xs">{doc.error}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {statusIcon[doc.status]}
                      <span className="text-xs text-muted-foreground">{statusLabel[doc.status]}</span>
                    </div>
                    {doc.status === "extracted" && (
                      <Link href="/inbox" className="text-xs text-primary hover:underline">
                        View in Inbox →
                      </Link>
                    )}
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
