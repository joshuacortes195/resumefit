import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { letterDocx, resumeDocx } from "@/lib/export/docx";
import { letterPdf, resumePdf } from "@/lib/export/pdf";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse, RequestError } from "@/lib/scan-request";

const exportSchema = z.object({
  text: z.string().min(1).max(60_000),
  format: z.enum(["docx", "pdf"]),
  kind: z.enum(["resume", "letter"]),
  name: z.string().max(120).default("document"),
});

const TYPES = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

// turns resume or letter text into a word file or a pdf to download
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getCurrentUser();
    // drawing a pdf is real work for the server, so it has a per minute limit like the other heavy things
    await rateLimit(user.id, "export");
    const parsed = exportSchema.safeParse(await request.json());
    if (!parsed.success) throw new RequestError("There is nothing to export yet.");
    const { text, format, kind, name } = parsed.data;

    const bytes = kind === "resume" ? (format === "pdf" ? await resumePdf(text) : await resumeDocx(text)) : format === "pdf" ? await letterPdf(text) : await letterDocx(text);
    const fileName = `${name.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "document"}.${format}`;
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": TYPES[format], "Content-Disposition": `attachment; filename="${fileName}"` } });
  } catch (error) {
    return errorResponse(error);
  }
}
