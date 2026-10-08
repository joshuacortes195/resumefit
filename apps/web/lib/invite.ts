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
