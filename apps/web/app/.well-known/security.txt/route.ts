import { SECURITY_TXT } from "@/lib/security-txt";

// the same plain text for everyone, so it is built once
export const dynamic = "force-static";

// sends the security contact file
export function GET(): Response {
  return new Response(SECURITY_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
