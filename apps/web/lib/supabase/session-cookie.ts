// how long a sign in lasts without a visit, the same 90 days an extension key lasts.
// the cookie is written again every time the session refreshes, so this counts from the last visit
export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;

// how the session cookies are set. scripts in the page cannot read them, and on the live site they only travel over https.
// nothing in the browser needs them, all sign in work happens on the server
export const SESSION_COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: SESSION_MAX_AGE };

// the sign in library writes its own 400 day age on every cookie it saves, whatever we ask for, so it is swapped for ours here.
// a cookie being cleared keeps its zero age
export function withSessionAge<T extends { maxAge?: number }>(options: T): T {
  return options.maxAge ? { ...options, maxAge: SESSION_MAX_AGE } : options;
}

// the sign in helper cookies left behind once the email link or google has been used: the code check for each attempt
// and the list of attempts. they are useless after sign in, so they are cleared instead of sitting there for months
export function signInLeftovers(names: string[]): string[] {
  return names.filter((name) => name.startsWith("sb-") && /-code-verifier(\.\d+)?$/.test(name));
}
