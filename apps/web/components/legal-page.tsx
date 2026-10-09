import Link from "next/link";
import { Logo } from "@/components/logo";

// shared frame for the privacy and terms pages
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      {/* plain reading text, with space between the parts */}
      <div className="mt-8 space-y-6 leading-7 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
      <p className="mt-10 flex gap-6 border-t border-border pt-6 text-sm">
        <Link href="/dashboard" className="font-semibold text-primary hover:underline">
          Back to the app
        </Link>
        <Link href="/privacy" className="text-muted hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="text-muted hover:text-foreground">
          Terms
        </Link>
      </p>
    </main>
  );
}
