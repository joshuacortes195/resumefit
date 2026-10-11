import { parseLinkedinText } from "@resumefit/scoring";
import { getCurrentUser } from "@/lib/auth";
import { FileError, readResumeFile } from "@/lib/files";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, RequestError } from "@/lib/scan-request";

// reads a linkedin profile pdf into the fields of the linkedin form. nothing is saved here
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) throw new RequestError("Pick your LinkedIn profile PDF first.");
    await rateLimit(user.id, "upload");
    try {
      const { text } = await readResumeFile(new Uint8Array(await file.arrayBuffer()), file.name);
      return Response.json({ profile: parseLinkedinText(text) });
    } catch (error) {
      if (error instanceof FileError) throw new RequestError(error.message);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
