// remembers which resume is open in the builder, so coming back to the builder lands on it again
export const DRAFT_COOKIE = "rf-builder";

// reads the cookie's value: the resume, and whether it was started in the builder and never finished
export function parseDraft(value: string | undefined): { id: string; fresh: boolean } | null {
  const match = value?.match(/^([0-9a-f-]{36})(\.fresh)?$/i);
  return match?.[1] ? { id: match[1], fresh: Boolean(match[2]) } : null;
}

// marks a resume as the one being worked on. only called in the browser
export function rememberDraft(id: string, fresh: boolean): void {
  document.cookie = `${DRAFT_COOKIE}=${id}${fresh ? ".fresh" : ""}; path=/builder; max-age=${60 * 60 * 24 * 60}; samesite=lax`;
}

// the builder goes back to its start screen next time
export function forgetDraft(): void {
  document.cookie = `${DRAFT_COOKIE}=; path=/builder; max-age=0; samesite=lax`;
}

// which resume the browser has open in the builder, if any
export function openDraft(): { id: string; fresh: boolean } | null {
  const value = document.cookie.split("; ").find((entry) => entry.startsWith(`${DRAFT_COOKIE}=`));
  return parseDraft(value?.slice(DRAFT_COOKIE.length + 1));
}

// where the step someone was on is kept
export const stepKey = (id: string) => `resumefit-builder-step-${id}`;
