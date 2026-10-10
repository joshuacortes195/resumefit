"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  pointerWithin,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArchiveRestore, Link2, Plus, Search } from "lucide-react";
import { JOB_STATUSES, type JobStatus } from "@resumefit/shared";
import { addJob, importJobFromLink, moveJobCard, setJobArchived } from "@/app/actions/jobs";
import { ScoreRing } from "@/components/score-ring";
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import { Modal } from "@/components/ui/modal";
import type { BoardJob } from "@/lib/data/jobs";
import { localToday } from "@/lib/job-tabs";

// the columns, each with a line that says what belongs there
const COLUMNS: Record<JobStatus, { label: string; blurb: string }> = {
  saved: { label: "Saved", blurb: "Jobs saved from the extension or a scan report appear here." },
  applied: { label: "Applied", blurb: "Application sent. Waiting to hear back." },
  interview: { label: "Interview", blurb: "Got an interview? Add the details and notes here." },
  offer: { label: "Offer", blurb: "Interviews done. Negotiating or waiting on a decision." },
  rejected: { label: "Rejected", blurb: "No response or a rejection. Review and adjust your approach." },
};

// how long ago a job was added, like "3d" or "2mo"
function age(createdAt: Date | string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

// what a card looks like, used on the board and under the cursor while dragging
function CardFace({ job, lifted = false }: { job: BoardJob; lifted?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm ${lifted ? "rotate-2 shadow-xl" : "shadow-sm"}`}>
      {job.matchRate === null ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-[5px] border-border text-xs text-muted" title="Not scanned yet">
          <span aria-hidden>-</span>
          <span className="sr-only">Not scanned yet</span>
        </span>
      ) : (
        <ScoreRing score={job.matchRate} size="sm" />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold leading-snug">{job.title}</p>
        {/* company on the left, how long ago it was added on the right */}
        <p className="mt-0.5 flex justify-between gap-2 text-xs text-muted">
          <span className="truncate">{job.company ?? "Company not set"}</span>
          <span className="shrink-0">{age(job.createdAt)}</span>
        </p>
      </div>
    </div>
  );
}

// one card that can be dragged, or clicked to open the job
function JobCard({ job, archived }: { job: BoardJob; archived: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id, disabled: archived });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-40" : ""}>
      {/* the link is the thing you grab. it stays a link, so enter opens the job and space picks the card up */}
      <Link href={`/tracker/${job.id}/job`} draggable={false} className="block rounded-xl transition-transform duration-150 hover:-translate-y-0.5" {...attributes} role={undefined} {...listeners}>
        <CardFace job={job} />
      </Link>
    </li>
  );
}

// one column of the board, also a place cards can be dropped
function Column({ status, jobs, archived, isOver }: { status: JobStatus; jobs: BoardJob[]; archived: boolean; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <section aria-label={COLUMNS[status].label} className="flex w-72 shrink-0 flex-col rounded-2xl bg-border/40 p-3 lg:w-auto lg:min-w-0 lg:flex-1">
      <h2 className="flex items-center justify-between px-1 text-base font-semibold">
        {COLUMNS[status].label}
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-muted">{jobs.length}</span>
      </h2>
      <p className="mt-1 min-h-8 px-1 text-xs text-muted">{COLUMNS[status].blurb}</p>
      <SortableContext items={jobs.map((job) => job.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className={`mt-3 flex min-h-24 flex-1 flex-col gap-2 rounded-xl transition-colors duration-150 ${isOver ? "bg-primary-soft" : ""}`}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} archived={archived} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

// the kanban board, with search, add job and the archived view
export function Board({ jobs: serverJobs, archived }: { jobs: BoardJob[]; archived: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  // the board keeps its own copy so cards move the instant you drop them
  const [jobs, setJobs] = useState(serverJobs);
  const [dragging, setDragging] = useState<BoardJob | null>(null);
  const [overColumn, setOverColumn] = useState<JobStatus | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // take the server's list again whenever it changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJobs(serverJobs);
  }, [serverJobs]);

  // a small drag distance so a plain click still opens the card. on the keyboard, space picks a card up and drops it
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }));

  const matches = (job: BoardJob) => `${job.title} ${job.company ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  const inColumn = (status: JobStatus, list = jobs) => list.filter((job) => job.status === status);
  // the column a drop target belongs to, the target is either a column or another card
  const columnOf = (targetId: string): JobStatus | null => (JOB_STATUSES as readonly string[]).includes(targetId) ? (targetId as JobStatus) : (jobs.find((job) => job.id === targetId)?.status ?? null);

  function handleDragStart(event: DragStartEvent) {
    setDragging(jobs.find((job) => job.id === event.active.id) ?? null);
  }

  // remembers which column the card is over so it can light up
  function handleDragOver(event: DragOverEvent) {
    setOverColumn(event.over ? columnOf(String(event.over.id)) : null);
  }

  // puts everything back the way it was before the drag
  function cancelDrag() {
    setDragging(null);
    setOverColumn(null);
  }

  // on drop, put the card in its new spot and save the column's order
  function handleDragEnd(event: DragEndEvent) {
    const moved = jobs.find((job) => job.id === event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    const target = overId ? columnOf(overId) : null;
    cancelDrag();
    if (!moved || !target || !overId || overId === moved.id) return;

    // the column without the card, then the card slotted in where it was dropped
    const column = inColumn(target).filter((job) => job.id !== moved.id);
    const overIndex = column.findIndex((job) => job.id === overId);
    let index = overIndex === -1 ? column.length : overIndex;
    // moving down inside the same column lands after the card it was dropped on
    if (moved.status === target && overIndex !== -1 && inColumn(target).findIndex((job) => job.id === moved.id) <= overIndex) index += 1;
    const ordered = [...column.slice(0, index), { ...moved, status: target }, ...column.slice(index)];
    setJobs([...jobs.filter((job) => job.status !== target && job.id !== moved.id), ...ordered]);

    setError(null);
    startTransition(async () => {
      const result = await moveJobCard(moved.id, target, ordered.map((job) => job.id), localToday());
      if (!result.ok) {
        // put things back if the save failed
        setError(result.error);
        setJobs(serverJobs);
      }
    });
  }

  // the card or column under the pointer wins, with the nearest one as a fallback for keyboard moves
  const collisionDetection: CollisionDetection = (args) => {
    const under = pointerWithin(args);
    if (under.length === 0) return closestCorners(args);
    // a card under the pointer is a more exact target than the column around it
    const cards = under.filter((hit) => !(JOB_STATUSES as readonly string[]).includes(String(hit.id)));
    return cards.length > 0 ? cards : under;
  };

  return (
    <div>
      {/* add job, search and the archived switch */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setAdding(true)} className={PRIMARY_BUTTON}>
          <Plus className="size-4" aria-hidden />
          Add Job
        </button>
        <label className="relative min-w-48 flex-1 sm:max-w-xs">
          <span className="sr-only">Search jobs</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" className={`${INPUT} bg-surface pl-9`} />
        </label>
        <button
          type="button"
          aria-pressed={archived}
          onClick={() => router.replace(archived ? pathname : `${pathname}?archived=1`)}
          className={`${SECONDARY_BUTTON} ml-auto py-2 ${archived ? "border-primary bg-primary-soft text-primary" : ""}`}
        >
          <Archive className="size-4" aria-hidden />
          Archived
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {archived ? (
        // archived jobs show as a plain list with a way to bring them back
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.filter(matches).map((job) => (
            <li key={job.id} className="flex items-center gap-2">
              <Link href={`/tracker/${job.id}/job`} className="min-w-0 flex-1">
                <CardFace job={job} />
              </Link>
              <button
                type="button"
                aria-label={`Restore ${job.title}`}
                disabled={pending}
                onClick={() => startTransition(async () => void (await setJobArchived(job.id, false)))}
                className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-foreground"
              >
                <ArchiveRestore className="size-4" aria-hidden />
              </button>
            </li>
          ))}
          {jobs.length === 0 && <li className="text-sm text-muted">Nothing archived. Jobs you archive from their card show up here.</li>}
        </ul>
      ) : (
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={cancelDrag}>
          {/* the columns scroll sideways on small screens */}
          <div className="-mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
            {JOB_STATUSES.map((status) => (
              <Column key={status} status={status} jobs={inColumn(status).filter(matches)} archived={archived} isOver={overColumn === status && dragging?.status !== status} />
            ))}
          </div>
          {/* the card that follows the cursor */}
          <DragOverlay>{dragging ? <CardFace job={dragging} lifted /> : null}</DragOverlay>
        </DndContext>
      )}

      <AddJobModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

// the form for adding a job. pasting the posting's link fills in the rest
function AddJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const blank = { url: "", title: "", company: "", location: "", description: "", status: "saved" as JobStatus };
  const [fields, setFields] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [importing, startImport] = useTransition();
  const set = (name: keyof typeof blank, value: string) => setFields((all) => ({ ...all, [name]: value }));

  // reads the posting behind the link and fills in the boxes
  function fillFromLink(url = fields.url) {
    if (!/^https:\/\/\S+\.\S+/.test(url.trim())) {
      setError("Paste the full link to the job posting, starting with https://");
      return;
    }
    startImport(async () => {
      setError(null);
      setNote(null);
      const result = await importJobFromLink(url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // what the page says wins, but anything it left out keeps what was typed
      setFields((all) => ({ ...all, title: result.title || all.title, company: result.company || all.company, location: result.location || all.location, description: result.description || all.description }));
      setNote(result.description.length > 200 ? "Filled in from the link. Check it over, then add the job." : "We found the title but not the full description. Paste the description in if you want to scan against it.");
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      setError(null);
      const result = await addJob(fields);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFields(blank);
      setNote(null);
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a job">
      <form action={handleSubmit} className="space-y-4">
        {/* the link comes first, it can fill in everything below it */}
        <div>
          <label htmlFor="add-job-link" className="block text-sm font-medium">
            Job posting link
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="add-job-link"
              type="url"
              value={fields.url}
              onChange={(event) => set("url", event.target.value)}
              // pasting a link into an empty form fills it in straight away
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text").trim();
                if (!fields.title && /^https:\/\/\S+$/.test(pasted)) fillFromLink(pasted);
              }}
              placeholder="https://"
              className={`${INPUT} min-w-0 flex-1 font-normal`}
            />
            <button type="button" disabled={importing} onClick={() => fillFromLink()} className={`${SECONDARY_BUTTON} shrink-0`}>
              <Link2 className="size-4" aria-hidden />
              {importing ? "Reading..." : "Fill in from link"}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Paste the link and we fill in the title, company and description for you.</p>
        </div>
        {note && (
          <p role="status" className="rounded-lg bg-primary-soft px-3 py-2 text-sm">
            {note}
          </p>
        )}
        <label className="block text-sm font-medium">
          Job title
          <input value={fields.title} onChange={(event) => set("title", event.target.value)} required maxLength={200} className={`${INPUT} mt-1 font-normal`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Company
            <input value={fields.company} onChange={(event) => set("company", event.target.value)} maxLength={200} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className="block text-sm font-medium">
            Location
            <input value={fields.location} onChange={(event) => set("location", event.target.value)} maxLength={200} className={`${INPUT} mt-1 font-normal`} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Column
          <select value={fields.status} onChange={(event) => set("status", event.target.value)} className={`${INPUT} mt-1 font-normal`}>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {COLUMNS[status].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Job description
          <textarea value={fields.description} onChange={(event) => set("description", event.target.value)} placeholder="Filled in from the link, or paste it here." className={`${INPUT} mt-1 h-28 resize-y font-normal`} />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={pending || importing} className={PRIMARY_BUTTON}>
            {pending ? "Adding..." : "Add job"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
