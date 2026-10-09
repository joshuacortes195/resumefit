import Link from "next/link";

type AiNoticeProps = {
  // false when no provider is set up
  available: boolean;
  // uses left today, null when this feature is not capped
  remaining: number | null;
};

// the small print next to every ai button: what is left today and what gets sent
export function AiNotice({ available, remaining }: AiNoticeProps) {
  if (!available) {
    return (
      <p className="text-xs text-muted">
        AI features are not set up yet.{" "}
        <Link href="/settings#ai" className="font-semibold text-primary hover:underline">
          Add a free Gemini key in Settings
        </Link>{" "}
        to turn them on. Everything else works without it.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted">
      {remaining !== null && (
        <span className="font-medium text-foreground">
          {remaining} AI {remaining === 1 ? "action" : "actions"} left today.{" "}
        </span>
      )}
      Your name and contact details are removed before anything is sent.{" "}
      <Link href="/privacy" className="underline hover:text-foreground">
        How this works
      </Link>
    </p>
  );
}
