import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/auth";

// reads the signed in user from the session, sends everyone else to the sign in page
export async function hostedUser(): Promise<CurrentUser> {
  // real sign in gets connected once the supabase project exists
  redirect("/sign-in");
}
