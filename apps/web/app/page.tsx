import { redirect } from "next/navigation";
import { Landing } from "@/components/landing";
import { authMode } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: { absolute: "ResumeFit: see how well your resume fits the job" } };

// the front door. someone signed in goes straight to their dashboard, everyone else sees what the app is
export default async function Home() {
  // on your own machine there is no signing in, so the app opens directly
  if (authMode() === "local") redirect("/dashboard");
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <Landing inviteOnly={serverEnv().INVITE_ONLY} />;
}
