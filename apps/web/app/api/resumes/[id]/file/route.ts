import { getCurrentUser } from "@/lib/auth";
import { builderPdf } from "@/lib/builder/export-pdf";
import { toBuilderResume } from "@/lib/data/builder";
import { getResume } from "@/lib/data/resumes";
import { withinLimit } from "@/lib/rate-limit";
import { loadFile } from "@/lib/storage";

// file names in a download header can only use plain characters
function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "resume";
}

// downloads a resume: the original file when we have it, otherwise its text
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!(await withinLimit(user.id, "export"))) return new Response("That is a lot of downloads in a short time. Wait a minute and try again.", { status: 429 });
  const resume = /^[0-9a-f-]{36}$/i.test(id) ? await getResume(user.id, id) : null;
  if (!resume) return new Response("Resume not found", { status: 404 });

  // resumes made in the builder are drawn fresh from their template
  if (resume.builderData) {
    const { data, settings } = toBuilderResume(resume);
    return new Response(Buffer.from(await builderPdf(data, settings)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeName(resume.name)}.pdf"` } });
  }

  const bytes = resume.filePath ? await loadFile(resume.filePath) : null;
  if (bytes && resume.fileType) {
    const type = resume.fileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${safeName(resume.name)}.${resume.fileType}"` } });
  }
  return new Response(resume.rawText ?? "", { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${safeName(resume.name)}.txt"` } });
}
