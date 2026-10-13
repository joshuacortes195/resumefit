import { parseLinkedinText } from "@resumefit/scoring";
import { getCurrentUser } from "@/lib/auth";
import { FileError, readResumeFile, uploadBytes } from "@/lib/files";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, readForm, RequestError } from "@/lib/scan-request";

// reading a file is the heaviest thing the app does, so the host stops a request that is still going after this many seconds
export const maxDuration = 30;

// reads a linkedin profile pdf into the fields of the linkedin form. nothing is saved here
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const file = (await readForm(request)).get("file");
    if (!(file instanceof File) || file.size === 0) throw new RequestError("Pick your LinkedIn profile PDF first.");
    await rateLimit(user.id, "upload");
    try {
      const { text } = await readResumeFile(await uploadBytes(file), file.name);
      return Response.json({ profile: parseLinkedinText(text) });
    } catch (error) {
      if (error instanceof FileError) throw new RequestError(error.message);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
