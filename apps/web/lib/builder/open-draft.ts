// remembers which resume is open in the builder, so coming back to the builder lands on it again
export const DRAFT_COOKIE = "rf-builder";

// reads the cookie's value: the resume, and whether it was started in the builder and never finished
export function parseDraft(value: string | undefined): { id: string; fresh: boolean } | null {
  const match = value?.match(/^([0-9a-f-]{36})(\.fresh)?$/i);
  return match?.[1] ? { id: match[1], fresh: Boolean(match[2]) } : null;
}

// the cookie line for the open resume. the page reads it itself so it can not be http only,
// but on the live site it only ever travels over https and never rides along on another site's requests
export function draftCookie(value: string, maxAge: number, https: boolean): string {
  return `${DRAFT_COOKIE}=${value}; path=/builder; max-age=${maxAge}; samesite=lax${https ? "; secure" : ""}`;
}

// marks a resume as the one being worked on. only called in the browser
export function rememberDraft(id: string, fresh: boolean): void {
  document.cookie = draftCookie(`${id}${fresh ? ".fresh" : ""}`, 60 * 60 * 24 * 60, location.protocol === "https:");
}

// the builder goes back to its start screen next time
export function forgetDraft(): void {
  document.cookie = draftCookie("", 0, location.protocol === "https:");
}

// which resume the browser has open in the builder, if any
export function openDraft(): { id: string; fresh: boolean } | null {
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(`${DRAFT_COOKIE}=`));
  return parseDraft(value?.slice(DRAFT_COOKIE.length + 1));
}

// where the step someone was on is kept
export const stepKey = (id: string) => `resumefit-builder-step-${id}`;
