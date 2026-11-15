import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BuilderStart } from "@/components/builder/start";
import { TemplateGallery } from "@/components/builder/template-gallery";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_COOKIE, parseDraft } from "@/lib/builder/open-draft";
import { getResume } from "@/lib/data/resumes";
import { isUuid } from "@/lib/ids";

export const metadata = { title: "Resume Builder" };

// where the builder starts: pick how you want to begin
export default function BuilderPage({ searchParams }: { searchParams: Promise<{ resume?: string; templates?: string }> }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-semibold sm:text-4xl">How would you like to start?</h1>
      <p className="mt-2 mb-6 max-w-2xl text-muted">Build a clean, single column resume that scanners read correctly. Every change is saved as you go.</p>
      {/* a link from the resume manager goes straight to that resume */}
      <Suspense fallback={null}>
        <OpenExisting searchParams={searchParams} />
      </Suspense>
      <BuilderStart />
      <TemplateGallery />
    </div>
  );
}

// sends "edit in builder" links, and anyone with a resume still open, on to the editor
async function OpenExisting({ searchParams }: { searchParams: Promise<{ resume?: string; templates?: string }> }) {
  const { resume, templates } = await searchParams;
  if (resume && isUuid(resume)) redirect(`/builder/${resume}`);
  // someone who came for the templates stays here to pick one, even with a resume still open
  if (templates) return null;
  // a resume that was being worked on opens again, right where it was left
  const draft = parseDraft((await cookies()).get(DRAFT_COOKIE)?.value);
  if (draft) {
    const user = await getCurrentUser();
    if (await getResume(user.id, draft.id)) redirect(`/builder/${draft.id}`);
  }
  return null;
}
