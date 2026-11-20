// links that come from job sites end up as buttons in the app. only plain web addresses are kept,
// so a feed that hands back something like a javascript: link can never put it under a button
export function webLink(raw: string): string {
  const value = raw.trim();
  try {
    return ["https:", "http:"].includes(new URL(value).protocol) ? value : "";
  } catch {
    return "";
  }
}
