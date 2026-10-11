import { z } from "zod";
import type { LayoutMeta } from "@resumefit/scoring";
import { DAILY_RESUME_LIMIT, getResume, resumesToday, saveResume } from "@/lib/data/resumes";
import { FileError, MAX_FILE_BYTES, readResumeFile, uploadBytes } from "@/lib/files";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

// a problem with what was sent that we can explain to the user
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// the resume a request points at, read and saved, ready to scan
export type ResolvedResume = { resumeId: string; text: string; layout: LayoutMeta | null };

// room for the file plus the pasted resume and job description that can ride along with it
const MAX_FORM_BYTES = MAX_FILE_BYTES + 512 * 1024;

// reads the form a request carries, turning away one that says it is too big before any of it is read
export async function readForm(request: Request): Promise<FormData> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FORM_BYTES) throw new RequestError("That upload is too big. Files can be up to 5 MB.", 413);
  try {
    return await request.formData();
  } catch {
    throw new RequestError("We could not read that upload. Try again.");
  }
}

// a form field as trimmed text, empty fields come back as undefined
export function field(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const resumeTextSchema = z.string().min(50, "That resume looks too short. Paste the full text.").max(60_000, "That resume is too long to scan.");

// works out which resume a form is about: an uploaded file, pasted text or a saved one
export async function resolveResume(userId: string, form: FormData, linkedJobId?: string | null): Promise<ResolvedResume> {
  const file = form.get("file");
  const resumeId = field(form, "resumeId");
  const resumeText = field(form, "resumeText");

  // picking a saved resume is always fine, adding new ones has a generous daily limit
  if (!resumeId && (await resumesToday(userId)) >= DAILY_RESUME_LIMIT) throw new RequestError(`You have added ${DAILY_RESUME_LIMIT} resumes in the last day. Pick one of your saved resumes, or try again tomorrow.`, 429);

  // a file that was just uploaded
  if (file instanceof File && file.size > 0) {
    // reading a file is the heavy part, so it has its own per minute limit
    await rateLimit(userId, "upload");
    try {
      const bytes = await uploadBytes(file);
      const { text, layout } = await readResumeFile(bytes, file.name);
      const name = field(form, "resumeName") ?? file.name.replace(/\.[a-z0-9]+$/i, "");
      const saved = await saveResume(userId, { name, text, layout, file: { bytes, type: layout.fileType }, linkedJobId });
      return { resumeId: saved.id, text, layout: (saved.layoutMeta as LayoutMeta | null) ?? layout };
    } catch (error) {
      if (error instanceof FileError) throw new RequestError(error.message);
      throw error;
    }
  }

  // one picked from the saved resumes
  if (resumeId) {
    const saved = await getResume(userId, resumeId);
    if (!saved?.rawText) throw new RequestError("We could not find that resume. Pick another one or upload it again.", 404);
    return { resumeId: saved.id, text: saved.rawText, layout: (saved.layoutMeta as LayoutMeta | null) ?? null };
  }

  // text pasted into the box
  const parsed = resumeTextSchema.safeParse(resumeText ?? "");
  if (!parsed.success) throw new RequestError(resumeText ? (parsed.error.issues[0]?.message ?? "Check your resume text.") : "Add a resume first. Upload a file, paste the text or pick a saved one.");
  const name = field(form, "resumeName") ?? `Pasted resume, ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const saved = await saveResume(userId, { name, text: parsed.data, linkedJobId });
  return { resumeId: saved.id, text: parsed.data, layout: null };
}

// turns anything thrown in a route into a json answer the form can show
export function errorResponse(error: unknown): Response {
  if (error instanceof RequestError || error instanceof RateLimitError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error instanceof Error ? error.message : "request failed");
  return Response.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
}

// a web address that starts with http or https. anything else, like a javascript: link, is turned away
export const webUrl = (message = "That link does not look right. Paste the full address, starting with https://") =>
  z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, message);
