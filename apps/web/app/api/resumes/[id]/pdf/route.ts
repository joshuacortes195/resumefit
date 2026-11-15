import { getCurrentUser } from "@/lib/auth";
import { builderPdf } from "@/lib/builder/export-pdf";
import { toBuilderResume } from "@/lib/data/builder";
import { getResume } from "@/lib/data/resumes";
import { resumePdf } from "@/lib/export/pdf";
import { isUuid } from "@/lib/ids";
import { withinLimit } from "@/lib/rate-limit";
import { loadFile } from "@/lib/storage";

// drawing a pdf can take a moment
export const maxDuration = 30;

// one of the person's own resumes as the pdf an employer would open, for looking at inside the app.
// the original upload when it is a pdf, a fresh one from the builder's template, or a plain one made from the text
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser();
  // a page of the manager shows ten of these at once, so the limit is roomier than the one for downloads
  if (!(await withinLimit(user.id, "preview"))) return new Response("That is a lot of previews in a short time. Wait a minute and try again.", { status: 429 });
  const resume = isUuid(id) ? await getResume(user.id, id) : null;
  if (!resume) return new Response("Resume not found", { status: 404 });

  let bytes: Uint8Array | null = null;
  // which of the three it is, so the page can say when the picture is not the original file
  let made: "original" | "builder" | "text" = "text";
  if (resume.builderData) {
    const { data, settings } = toBuilderResume(resume);
    bytes = await builderPdf(data, settings);
    made = "builder";
  } else if (resume.filePath && resume.fileType === "pdf") {
    bytes = await loadFile(resume.filePath);
    if (bytes) made = "original";
  }
  bytes ??= await resumePdf(resume.rawText ?? "");
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Resume-Preview": made } });
}
