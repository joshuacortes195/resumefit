"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

// a small bin button for one row in a history list. the first press asks, the second one deletes
export function DeleteRow({ id, action, what }: { id: string; action: (id: string) => Promise<{ ok: boolean }>; what: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  // the bin on its own until it is pressed
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} aria-label={`Delete this ${what}`} className="shrink-0 rounded-md p-2 text-muted transition-colors duration-150 hover:bg-surface hover:text-danger">
        <Trash2 className="size-4" aria-hidden />
      </button>
    );
  }

  // then a yes and a no, right where the bin was
  return (
    <span className="flex shrink-0 items-center gap-1 text-sm">
      <button type="button" disabled={pending} onClick={() => startTransition(async () => void (await action(id)))} className="rounded-md px-2 py-1 font-medium text-danger hover:bg-danger/10">
        {pending ? "Deleting..." : "Delete"}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className="rounded-md px-2 py-1 text-muted hover:bg-surface">
        Keep
      </button>
    </span>
  );
}
