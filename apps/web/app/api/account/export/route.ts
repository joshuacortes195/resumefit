import { getCurrentUser } from "@/lib/auth";
import { exportAccount } from "@/lib/data/account";
import { withinLimit } from "@/lib/rate-limit";

// downloads everything stored for the signed in person as one zip
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!(await withinLimit(user.id, "account-export"))) return new Response("That is a lot of downloads in a short time. Wait a minute and try again.", { status: 429 });
  const zip = await exportAccount(user.id);
  return new Response(Buffer.from(zip), { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="resumefit-export.zip"' } });
}
