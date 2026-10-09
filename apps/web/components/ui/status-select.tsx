"use client";

import { JOB_STATUSES, type JobStatus } from "@resumefit/shared";

type StatusSelectProps = {
  value: JobStatus | null;
  onChange: (status: JobStatus) => void;
  disabled?: boolean;
  label: string;
};

// dropdown for where a job stands, the same list the tracker columns use
export function StatusSelect({ value, onChange, disabled, label }: StatusSelectProps) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as JobStatus)}
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm transition-colors duration-150 focus:border-primary disabled:opacity-50"
    >
      {/* shown until the job is on the tracker */}
      {value === null && <option value="">Not tracked</option>}
      {JOB_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </option>
      ))}
    </select>
  );
}
