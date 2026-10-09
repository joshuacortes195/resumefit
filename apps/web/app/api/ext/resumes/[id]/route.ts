import { builderPdf } from "@/lib/builder/export-pdf";
import { toBuilderResume } from "@/lib/data/builder";
import { getResume } from "@/lib/data/resumes";
import { resumePdf } from "@/lib/export/pdf";
import { ExtError, extRoute, preflight } from "@/lib/ext-auth";
import { loadFile } from "@/lib/storage";

export const OPTIONS = preflight;

// hands the extension a resume file to attach to an application
export const GET = extRoute(async (_request, user, { params }) => {
  const { id } = await params;
  const resume = /^[0-9a-f-]{36}$/i.test(id ?? "") ? await getResume(user.id, id ?? "") : null;
  if (!resume) throw new ExtError("We could not find that resume.", 404);

  // the original upload when we have it, otherwise a clean pdf made from the text
  const stored = resume.filePath && !resume.builderData ? await loadFile(resume.filePath) : null;
  const type = stored ? (resume.fileType ?? "pdf") : "pdf";
  const built = toBuilderResume(resume);
  const bytes = stored ?? (resume.builderData ? await builderPdf(built.data, built.settings) : await resumePdf(resume.rawText ?? ""));
  const name = `${resume.name.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "Resume"}.${type}`;
  return { name, type: type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", base64: Buffer.from(bytes).toString("base64") };
});
