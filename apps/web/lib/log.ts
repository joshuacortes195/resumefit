// what is safe to write to the server log about something that went wrong.
// a failed database query carries the whole query and every value in its message, which can be someone's resume,
// so for those only the database's own short reason is kept
export function safeErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if ("query" in error && "params" in error) {
    const cause = error.cause;
    return `database query failed: ${cause instanceof Error ? cause.message.slice(0, 300) : "no reason given"}`;
  }
  return error.message.slice(0, 500) || fallback;
}

// postgres cannot store this character, and a file or a paste can carry it
export function withoutNulls(text: string): string {
  return text.includes("\u0000") ? text.replaceAll("\u0000", "") : text;
}
