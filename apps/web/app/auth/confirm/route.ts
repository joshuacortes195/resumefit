import { NextResponse } from "next/server";
import { finishSignIn } from "@/lib/finish-sign-in";
import { supabaseServer } from "@/lib/supabase/server";

// the kinds of email link the sign in service can send here
const TYPES = new Set(["email", "magiclink", "signup", "invite", "recovery", "email_change"]);

// where the email sign in link sends people. the link carries a one time hash the server checks by itself,
// so it works in any browser or on another device, not only the one that asked for it
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "email";
  if (!hash || hash.length > 200 || !TYPES.has(type)) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: hash, type: type as "email" });
  // a used, replaced or old link ends up here
  if (error) return NextResponse.redirect(new URL("/sign-in?error=used", url.origin));
  return NextResponse.redirect(new URL(await finishSignIn(data.user), url.origin));
}
