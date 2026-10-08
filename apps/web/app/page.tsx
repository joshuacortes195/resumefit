import { redirect } from "next/navigation";

// the home url just sends you to the dashboard
export default function Home() {
  redirect("/dashboard");
}
