import { getCurrentUser } from "@/lib/auth";
import { errorResponse, readForm, resolveResume } from "@/lib/scan-request";

// reading a file is the heaviest thing the app does, so the host stops a request that is still going after this many seconds
export const maxDuration = 30;

// saves an uploaded or pasted resume to the resume manager
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    const resume = await resolveResume(user.id, await readForm(request));
    return Response.json({ id: resume.resumeId });
  } catch (error) {
    return errorResponse(error);
  }
}
