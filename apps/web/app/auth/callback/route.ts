import { NextResponse } from "next/server";
import { finishSignIn } from "@/lib/finish-sign-in";
import { supabaseServer } from "@/lib/supabase/server";

// where google, and email links sent before the confirm route existed, send people back to.
// this kind of link only works in the browser that asked for it, since it needs a cookie that browser saved
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // no code at all means the link was cut short or already failed at the sign in service
  if (!code) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  // most often the link was opened in another browser or app, where the code check cookie is missing
  if (error) return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
  return NextResponse.redirect(new URL(await finishSignIn(data.user), url.origin));
}
