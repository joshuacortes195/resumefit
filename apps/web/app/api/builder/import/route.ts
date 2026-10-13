import { parseResume } from "@resumefit/scoring";
import { getCurrentUser } from "@/lib/auth";
import { builderFromParsed } from "@/lib/builder/layout";
import { createBuilderResume } from "@/lib/data/builder";
import { DAILY_RESUME_LIMIT, resumesToday } from "@/lib/data/resumes";
import { FileError, readResumeFile, uploadBytes } from "@/lib/files";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, field, readForm, RequestError } from "@/lib/scan-request";

// reading a file is the heaviest thing the app does, so the host stops a request that is still going after this many seconds
export const maxDuration = 30;

// reads an uploaded resume or a linkedin profile pdf and opens it in the builder
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const form = await readForm(request);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new RequestError("Pick a file first.");
    await rateLimit(user.id, "upload");
    if ((await resumesToday(user.id)) >= DAILY_RESUME_LIMIT) throw new RequestError(`You have added ${DAILY_RESUME_LIMIT} resumes in the last day. Try again tomorrow.`, 429);

    let text: string;
    try {
      ({ text } = await readResumeFile(await uploadBytes(file), file.name));
    } catch (error) {
      if (error instanceof FileError) throw new RequestError(error.message);
      throw error;
    }
    const fromLinkedin = field(form, "source") === "linkedin";
    const id = await createBuilderResume(user.id, { data: builderFromParsed(parseResume(text)), source: fromLinkedin ? "linkedin" : "builder" });
    return Response.json({ id });
  } catch (error) {
    return errorResponse(error);
  }
}
