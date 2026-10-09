"use client";

import { SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Modal } from "@/components/ui/modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  // what the red button says, like "Delete"
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// asks "are you sure" before something that cannot be undone
export function ConfirmDialog({ open, title, message, confirmLabel, pending = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 dark:text-background"
        >
          {pending ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
