import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BuilderEditor } from "@/components/builder/editor";
import { ReportSkeleton } from "@/components/ui/skeleton";
import { remainingToday } from "@/lib/ai/limits";
import { aiAvailable } from "@/lib/ai/router";
import { getCurrentUser } from "@/lib/auth";
import { DRAFT_COOKIE, parseDraft } from "@/lib/builder/open-draft";
import { toBuilderResume } from "@/lib/data/builder";
import { getResume } from "@/lib/data/resumes";

export const metadata = { title: "Resume Builder" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> };

// the builder for one resume
export default function BuilderEditorPage(props: Props) {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <EditorLoader {...props} />
    </Suspense>
  );
}

// loads the resume's answers and look
async function EditorLoader({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const row = /^[0-9a-f-]{36}$/i.test(id) ? await getResume(user.id, id) : null;
  if (!row) notFound();
  const resume = toBuilderResume(row);
  const [available, remaining] = await Promise.all([aiAvailable(user.id), remainingToday(user.id, "builder")]);
  // a resume started in the builder and not finished yet can still be cancelled
  const draft = parseDraft((await cookies()).get(DRAFT_COOKIE)?.value);
  const fresh = query.new === "1" || (draft?.id === resume.id && draft.fresh);
  return <BuilderEditor key={resume.id} id={resume.id} initialData={resume.data} initialSettings={resume.settings} isNew={query.new === "1"} fresh={fresh} ai={{ available, remaining }} />;
}
