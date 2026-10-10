// the bits of an invite code row we need to check it
export type InviteCode = {
  code: string;
  maxUses: number;
  uses: number;
  expiresAt: Date | null;
};

export type InviteCheck = { ok: true } | { ok: false; reason: "missing" | "not_found" | "expired" | "used_up" };

// cleans up what the user typed so codes are not case or space sensitive
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

// decides if someone can sign up with this code
export function checkInviteCode(input: string | null | undefined, invite: InviteCode | null, now: Date = new Date()): InviteCheck {
  if (!input || normalizeInviteCode(input) === "") return { ok: false, reason: "missing" };
  if (!invite || normalizeInviteCode(invite.code) !== normalizeInviteCode(input)) return { ok: false, reason: "not_found" };
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (invite.uses >= invite.maxUses) return { ok: false, reason: "used_up" };
  return { ok: true };
}

// friendly text for the sign up form
export const INVITE_ERRORS: Record<Exclude<InviteCheck, { ok: true }>["reason"], string> = {
  missing: "Enter your invite code to sign up.",
  not_found: "That invite code doesn't exist. Check for typos.",
  expired: "That invite code has expired. Ask for a new one.",
  used_up: "That invite code has already been used.",
};

// the short codes other pages send people back to sign in with, and what each one says.
// only these are ever shown, so a link cannot put its own words on the sign in page
export const SIGN_IN_ERRORS: Record<string, string> = {
  invite: "You need an invite code to join. Enter it below and sign in again.",
  google: "Google sign in did not work. Try again, or use an email link.",
  link: "That sign in link did not work or has expired. Ask for a new one.",
  missing: INVITE_ERRORS.missing,
  not_found: INVITE_ERRORS.not_found,
  expired: INVITE_ERRORS.expired,
  used_up: INVITE_ERRORS.used_up,
};

// the code for an invite message, so it can travel in an address
export function inviteErrorCode(message: string): string {
  return Object.entries(INVITE_ERRORS).find(([, text]) => text === message)?.[0] ?? "invite";
}
