import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BuilderStart } from "@/components/builder/start";

export const metadata = { title: "Resume Builder" };

// where the builder starts: pick how you want to begin
export default function BuilderPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold sm:text-4xl">How would you like to start?</h1>
      <p className="mt-2 mb-6 max-w-2xl text-muted">Build a clean, single column resume that scanners read correctly. Every change is saved as you go.</p>
      {/* a link from the resume manager goes straight to that resume */}
      <Suspense fallback={null}>
        <OpenExisting searchParams={searchParams} />
      </Suspense>
      <BuilderStart />
    </div>
  );
}

// sends "edit in builder" links on to the editor
async function OpenExisting({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const { resume } = await searchParams;
  if (resume && /^[0-9a-f-]{36}$/i.test(resume)) redirect(`/builder/${resume}`);
  return null;
}
