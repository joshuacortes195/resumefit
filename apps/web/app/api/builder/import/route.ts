import { parseResume } from "@resumefit/scoring";
import { getCurrentUser } from "@/lib/auth";
import { builderFromParsed } from "@/lib/builder/layout";
import { createBuilderResume } from "@/lib/data/builder";
import { DAILY_RESUME_LIMIT, resumesToday } from "@/lib/data/resumes";
import { FileError, readResumeFile } from "@/lib/files";
import { errorResponse, field, RequestError } from "@/lib/scan-request";

// reads an uploaded resume or a linkedin profile pdf and opens it in the builder
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new RequestError("Pick a file first.");
    if ((await resumesToday(user.id)) >= DAILY_RESUME_LIMIT) throw new RequestError(`You have added ${DAILY_RESUME_LIMIT} resumes in the last day. Try again tomorrow.`, 429);

    let text: string;
    try {
      ({ text } = await readResumeFile(new Uint8Array(await file.arrayBuffer()), file.name));
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
