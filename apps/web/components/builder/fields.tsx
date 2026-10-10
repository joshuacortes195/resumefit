"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { INPUT } from "@/components/ui/buttons";

// a labelled text box
export function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {required && <span className="text-danger"> *</span>}
      <input type={type} value={value} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${INPUT} mt-1 font-normal`} />
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

// small round button used for moving and removing list items
export function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-1.5 text-muted transition-colors duration-150 disabled:opacity-30 ${danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-primary-soft hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

// up, down and remove for one item in a list
export function ItemControls({ name, index, count, onMove, onRemove }: { name: string; index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <span className="flex shrink-0">
      <IconButton label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp className="size-4" aria-hidden />
      </IconButton>
      <IconButton label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown className="size-4" aria-hidden />
      </IconButton>
      <IconButton label={`Remove ${name}`} danger onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden />
      </IconButton>
    </span>
  );
}

// moves one item of a list to a new spot
export function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

// a list of one line entries, like bullets, certifications or awards
export function LineList({ label, items, onChange, placeholder, addLabel, multiline }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string; addLabel: string; multiline?: boolean }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <ul className="mt-1 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-1">
            {multiline ? (
              <textarea aria-label={`${label} ${index + 1}`} value={item} placeholder={placeholder} rows={2} onChange={(event) => onChange(items.map((entry, position) => (position === index ? event.target.value : entry)))} className={`${INPUT} resize-y`} />
            ) : (
              <input aria-label={`${label} ${index + 1}`} value={item} placeholder={placeholder} onChange={(event) => onChange(items.map((entry, position) => (position === index ? event.target.value.replace(/\n/g, " ") : entry)))} className={INPUT} />
            )}
            <ItemControls name={`${label.toLowerCase()} ${index + 1}`} index={index} count={items.length} onMove={(to) => onChange(move(items, index, to))} onRemove={() => onChange(items.filter((_, position) => position !== index))} />
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...items, ""])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
        <Plus className="size-4" aria-hidden />
        {addLabel}
      </button>
    </fieldset>
  );
}
