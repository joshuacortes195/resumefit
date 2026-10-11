import { Logo } from "@/components/logo";
import { NotFoundMessage } from "@/components/not-found-message";

export const metadata = { title: "Not found" };

// shown for any address the app does not have at all
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4 py-12">
      <Logo />
      <NotFoundMessage />
    </main>
  );
}
