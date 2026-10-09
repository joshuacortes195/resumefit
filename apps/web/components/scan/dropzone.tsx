"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { LINK_BUTTON } from "@/components/ui/buttons";

// biggest file we take, same limit the server checks
const MAX_BYTES = 5 * 1024 * 1024;

type DropzoneProps = {
  file: File | null;
  onFile: (file: File | null) => void;
};

// the box you drag a resume onto, or click to pick one
export function Dropzone({ file, onFile }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // checks the type and size before we keep the file
  function take(next: File | undefined) {
    if (!next) return;
    if (!/\.(pdf|docx)$/i.test(next.name)) {
      setProblem("We can only read PDF and DOCX files.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setProblem("That file is over 5 MB. Try exporting it again.");
      return;
    }
    setProblem(null);
    onFile(next);
  }

  // once a file is picked, show its name with a way to remove it
  if (file) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-background p-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <FileText className="size-6" aria-hidden />
        </span>
        <p className="max-w-full truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</p>
        <button type="button" onClick={() => onFile(null)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <X className="size-4" aria-hidden />
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          take(event.dataTransfer.files[0]);
        }}
        className={`flex h-64 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-4 text-center transition-colors duration-150 ${
          dragging ? "border-primary bg-primary-soft" : "border-border bg-background"
        }`}
      >
        <span className={`flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform duration-200 ${dragging ? "-translate-y-1" : ""}`}>
          <Upload className="size-6" aria-hidden />
        </span>
        <p className="text-sm">
          Drag your resume here or{" "}
          <button type="button" onClick={() => inputRef.current?.click()} className={LINK_BUTTON}>
            upload a file
          </button>
        </p>
        <p className="text-xs text-muted">PDF or DOCX, up to 5 MB</p>
        {/* the real file input, hidden behind the button above */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload your resume"
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {problem && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
