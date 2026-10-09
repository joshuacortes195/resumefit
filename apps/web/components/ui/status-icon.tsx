import { Check, Info, X } from "lucide-react";

// green check, red x or a grey note, with hidden text so color is not the only signal
export function StatusIcon({ status }: { status: "pass" | "fail" | "info" }) {
  if (status === "pass") {
    return (
      <span className="mt-0.5 shrink-0 text-success">
        <Check className="size-4" aria-hidden />
        <span className="sr-only">Passed: </span>
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="mt-0.5 shrink-0 text-danger">
        <X className="size-4" aria-hidden />
        <span className="sr-only">Needs work: </span>
      </span>
    );
  }
  return (
    <span className="mt-0.5 shrink-0 text-muted">
      <Info className="size-4" aria-hidden />
      <span className="sr-only">Note: </span>
    </span>
  );
}
