import type { ApplicationStatus } from "@resumefit/shared";

// how many days a filled in application can sit before it is called abandoned
export const ABANDONED_DAYS = 7;

// what one auto apply run is called in the list, and the color it wears
export type RunLabel = { text: "Filling in" | "Filled in" | "Needs review" | "Submitted by me" | "Sent for me" | "Abandoned" | "Could not fill"; tone: "good" | "warn" | "muted" | "bad" };

// works out what to call a run from how it was left and how long ago
export function runLabel(run: { status: ApplicationStatus; fieldsNeedingAttention: number; updatedAt: Date | string; sentBy?: "me" | "auto" }, now = new Date()): RunLabel {
  if (run.status === "applied") return { text: run.sentBy === "auto" ? "Sent for me" : "Submitted by me", tone: "good" };
  if (run.status === "failed") return { text: "Could not fill", tone: "bad" };
  // filled in and then left alone for a week: the person most likely moved on
  const idleDays = (now.getTime() - new Date(run.updatedAt).getTime()) / 86_400_000;
  if (idleDays >= ABANDONED_DAYS) return { text: "Abandoned", tone: "muted" };
  if (run.status === "queued" || run.status === "autofilling") return { text: "Filling in", tone: "muted" };
  return run.fieldsNeedingAttention > 0 ? { text: "Needs review", tone: "warn" } : { text: "Filled in", tone: "good" };
}
