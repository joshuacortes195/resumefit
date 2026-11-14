import type { Profile } from "@/lib/profile";

// one rule a posting sets about who can apply, and how it lines up with the person's own answers.
// ok: their profile meets it. problem: it does not. check: we cannot tell, so they should look before applying
export type EligibilityItem = { rule: "citizenship" | "clearance" | "sponsorship" | "graduation" | "onsite" | "relocation"; verdict: "ok" | "problem" | "check"; text: string; quote: string; missing?: boolean };
// missing is set when the only reason we cannot tell is an answer the application profile does not have yet

// the answers the check needs. all of them can be missing
export type EligibilityProfile = Partial<Pick<Profile, "workAuthorization" | "needsSponsorship" | "graduationYear" | "willingToRelocate">>;

// the sentence a match sits in, so the person can see the posting's own words.
// a full stop only ends a sentence when a lower case letter or a digit comes before it, so "U.S." stays whole
function sentence(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const lineEnd = text.indexOf("\n", index) === -1 ? text.length : text.indexOf("\n", index);
  const line = text.slice(lineStart, lineEnd);
  let at = 0;
  for (const part of line.split(/(?<=[a-z0-9)][.!?])\s+(?=[A-Z])/)) {
    if (index - lineStart < at + part.length + 1) return part.replace(/\s+/g, " ").trim().slice(0, 240);
    at += part.length + 1;
  }
  return line.replace(/\s+/g, " ").trim().slice(0, 240);
}

const CITIZEN = /\b(u\.?s\.?|united states) citizen(ship)?\b|\bu\.?s\.? persons?\b|\bitar\b/i;
const CLEARANCE = /\b(security clearance|secret clearance|top secret|ts\/sci|public trust clearance|clearance (is )?required|ability to obtain (a |an )?[a-z /]*clearance)\b/i;
const NO_SPONSOR = /\b(not|unable to|cannot|can ?not|won'?t|will not|do(es)? not|no)\b[^.\n]{0,50}\bsponsor|\bwithout (the need for |requiring )?(visa |employment |work )?sponsorship\b/i;
const GRADUATION = /\b(?:graduat(?:e|es|ing|ion)|degree (?:completion|conferral)|completing (?:a |your |their )?(?:bachelor|master|degree|b\.?s|m\.?s))\b[^.\n]{0,120}?\b(20\d\d)\b(?:[^.\n]{0,40}?\b(?:and|to|through|or|-|–)\s*(?:[a-z]+\s+)?(20\d\d)\b)?/i;
const ONSITE = /\b(\d|one|two|three|four|five)\s*(\+\s*)?days?\s*(a|per|each)\s*week\s*(in|on|at)[\s-]*(the\s*)?(office|site)\b|\b(fully |100% )?(on-?site|in-?person|in[\s-]office)\b(?![^.\n]{0,20}\b(optional|not required)\b)/i;
const RELOCATE = /\b(must|required to|willing(ness)? to|able to) relocate\b|\brelocation (is )?required\b/i;

// reads a posting for the rules that decide whether someone can apply at all, and compares each with their profile.
// it only reports rules the posting actually states, and it never decides anything from a missing answer
export function checkEligibility(jdText: string, profile: EligibilityProfile = {}): EligibilityItem[] {
  const items: EligibilityItem[] = [];
  const auth = profile.workAuthorization ?? null;

  const citizen = CITIZEN.exec(jdText);
  if (citizen) {
    const quote = sentence(jdText, citizen.index);
    // "us person" covers citizens and permanent residents
    const persons = /persons?\b|itar/i.test(citizen[0]);
    const meets = auth === "US citizen" || (persons && auth === "Permanent resident");
    items.push(
      auth === null
        ? { rule: "citizenship", verdict: "check", text: `This role asks for ${persons ? "US person status" : "US citizenship"}.`, quote, missing: true }
        : meets
          ? { rule: "citizenship", verdict: "ok", text: `This role asks for ${persons ? "US person status" : "US citizenship"}, and your profile says ${auth}.`, quote }
          : { rule: "citizenship", verdict: "problem", text: `This role asks for ${persons ? "US person status" : "US citizenship"}, and your profile says ${auth}.`, quote },
    );
  }

  const clearance = CLEARANCE.exec(jdText);
  if (clearance) {
    const quote = sentence(jdText, clearance.index);
    const obtain = /obtain/i.test(quote);
    items.push({
      rule: "clearance",
      // only a citizen can be cleared, so anyone else is told plainly
      verdict: auth !== null && auth !== "US citizen" ? "problem" : "check",
      text: auth !== null && auth !== "US citizen" ? `This role involves a security clearance, which needs US citizenship, and your profile says ${auth}.` : `This role involves a security clearance${obtain ? " you would have to be able to get" : ""}. Check whether you need to hold one already.`,
      quote,
    });
  }

  const sponsor = NO_SPONSOR.exec(jdText);
  if (sponsor) {
    const quote = sentence(jdText, sponsor.index);
    const needs = profile.needsSponsorship ?? null;
    items.push(
      needs === null
        ? { rule: "sponsorship", verdict: "check", text: "This employer says it does not sponsor visas.", quote, missing: true }
        : needs
          ? { rule: "sponsorship", verdict: "problem", text: "This employer says it does not sponsor visas, and your profile says you will need sponsorship.", quote }
          : { rule: "sponsorship", verdict: "ok", text: "This employer says it does not sponsor visas, and your profile says you do not need it.", quote },
    );
  }

  const graduation = GRADUATION.exec(jdText);
  if (graduation) {
    const quote = sentence(jdText, graduation.index);
    const years = [graduation[1], graduation[2]].filter(Boolean).map(Number);
    const first = Math.min(...years);
    const last = Math.max(...years);
    const mine = profile.graduationYear ? Number(profile.graduationYear) : null;
    const window = first === last ? String(first) : `${first} to ${last}`;
    items.push(
      mine === null
        ? { rule: "graduation", verdict: "check", text: `This role names a graduation date (${window}).`, quote, missing: true }
        : mine >= first && mine <= last
          ? { rule: "graduation", verdict: "ok", text: `This role wants a graduation date in ${window}, and yours is ${mine}.`, quote }
          : { rule: "graduation", verdict: "problem", text: `This role wants a graduation date in ${window}, and yours is ${mine}.`, quote },
    );
  }

  const onsite = ONSITE.exec(jdText);
  if (onsite) items.push({ rule: "onsite", verdict: "check", text: "This role expects you in person. Make sure the location works for you.", quote: sentence(jdText, onsite.index) });

  const relocate = RELOCATE.exec(jdText);
  if (relocate) {
    const quote = sentence(jdText, relocate.index);
    const willing = profile.willingToRelocate ?? null;
    items.push(
      willing === false
        ? { rule: "relocation", verdict: "problem", text: "This role asks you to relocate, and your profile says you are not willing to.", quote }
        : { rule: "relocation", verdict: willing ? "ok" : "check", text: willing ? "This role asks you to relocate, and your profile says you are willing to." : "This role asks you to relocate.", quote },
    );
  }
  return items;
}
