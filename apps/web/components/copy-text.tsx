"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// a bit of text with a button that copies it, for things that cannot be made into a link
export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-background py-0.5 pl-2 pr-1 align-middle">
      <code className="text-sm">{text}</code>
      <button
        type="button"
        aria-label={`Copy ${text}`}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary-soft"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
