import Link from "next/link";
import { SearchX } from "lucide-react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";

// what people see when an address points at nothing: a scan that was deleted, a mistyped link, a job that is not theirs
export function NotFoundMessage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">The link may be mistyped, or what it pointed to has been deleted. Nothing is wrong with your account.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className={PRIMARY_BUTTON}>
          Go to the dashboard
        </Link>
        <Link href="/scans" className={SECONDARY_BUTTON}>
          Scan history
        </Link>
      </div>
    </div>
  );
}
