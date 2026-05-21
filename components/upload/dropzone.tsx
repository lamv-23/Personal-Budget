"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function Dropzone() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function uploadFile(file: File) {
    setStatus("uploading");
    setMessage(`Uploading ${file.name}...`);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setStatus("success");
      setMessage(`${file.name} uploaded — AI is extracting transactions`);
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
        router.refresh();
      }, 3000);
    } else {
      setStatus("error");
      setMessage(data.error ?? "Upload failed");
      setTimeout(() => { setStatus("idle"); setMessage(""); }, 5000);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    uploadFile(files[0]);
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30",
        status === "uploading" && "pointer-events-none opacity-75"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,image/*"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
        {status === "idle" && (
          <>
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop a file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">PDFs, JPG, PNG, WEBP up to 20MB</p>
              <p className="text-xs text-muted-foreground">Bills, payslips, dividend statements, receipts</p>
            </div>
          </>
        )}
        {status === "uploading" && (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-8 w-8 text-green-600" />
            <p className="text-sm text-green-700 font-medium">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
