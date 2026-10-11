"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // wide fits the scan form, the default fits a short form
  size?: "md" | "wide";
};

// a pop up window built on the browser's own dialog, so focus and the escape key just work
export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // true while we close the dialog ourselves, so that does not count as the user closing it
  const quiet = useRef(false);

  // opens and closes the dialog to match the open prop
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // when the page it sits on goes away or is tucked into the background, the dialog must not keep blocking the screen
    return () => {
      if (!dialog.open) return;
      // the close event arrives a moment later, the flag is cleared when it does
      quiet.current = true;
      dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (quiet.current) quiet.current = false;
        else onClose();
      }}
      // a click on the dark area around the box closes it
      onClick={(event) => event.target === ref.current && onClose()}
      aria-label={title}
      // never taller than the screen: what does not fit scrolls inside the box
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border/70 bg-surface shadow-card p-0 text-foreground shadow-xl backdrop:bg-black/50 open:animate-pop ${
        size === "wide" ? "max-w-4xl" : "max-w-md"
      }`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-m-1 rounded-lg p-1 text-muted hover:bg-primary-soft hover:text-foreground">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
