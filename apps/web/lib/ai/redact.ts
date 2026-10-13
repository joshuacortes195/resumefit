import type { ResumeContact } from "@resumefit/scoring";

// text with the personal details swapped out, and a way to put them back
export type Redacted = {
  text: string;
  restore: (text: string) => string;
};

// hides details in several pieces of text that share one set of placeholders, so one restore works for all of them
export type Redactor = {
  hide: (text: string) => string;
  restore: (text: string) => string;
};

// every repeat here has an upper bound, so a long run of letters or digits cannot make these slow
const EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}/g;
const URL = /(?:https?:\/\/|www\.)[^\s,;|)]{1,2000}|\b(?:linkedin\.com|github\.com)\/[^\s,;|)]{1,2000}/gi;
// a handle written next to the name of the site, like "github: @someone"
const HANDLE = /\b(?:github|gitlab|linkedin|twitter|instagram)\s?[:@]\s?@?[\w.-]{2,40}/gi;
// a government id written the us way
const ID_NUMBER = /\b\d{3}-\d{2}-\d{4}\b/g;
// a date of birth, with the words in front of it
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]{0,6}\\.?";
const BIRTH = new RegExp(`\\b(?:date of birth|d\\.?o\\.?b\\.?|born(?: on)?)\\s?[:\\-]?\\s?(?:\\d{1,2}[/.\\- ]\\d{1,2}[/.\\- ]\\d{2,4}|\\d{4}[/.\\-]\\d{1,2}[/.\\-]\\d{1,2}|(?:\\d{1,2}(?:st|nd|rd|th)? )?${MONTH},? ?(?:\\d{1,2}(?:st|nd|rd|th)?,? )?\\d{4})`, "gi");
// anything shaped like a phone number from any country. what it finds is checked again in looksLikePhone
const PHONE = /(?<![\w.])\+?\(?\d[\d ().\- ]{6,20}\d(?!\w)/g;
// a street address. the short endings need capital letters in front, since "way", "court" and "drive" are ordinary words too
const STREET_ENDS = "Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Terrace|Ter|Place|Pl|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Square|Sq|Trail|Crescent|Close";
const UNIT = "(?:,? (?:Apt|Apartment|Unit|Suite|Ste|#)\\.? ?[\\w-]{1,8})?";
const STREET = new RegExp(`\\b\\d{1,5}[A-Za-z]? (?:[NSEW]\\.? )?[A-Z][A-Za-z']{0,30}(?: [A-Z][A-Za-z']{0,30}){0,3} (?:${STREET_ENDS})\\b\\.?${UNIT}`, "g");
// these endings only ever mean an address, so they are found in any case
const STREET_ANY_CASE = new RegExp(`\\b\\d{1,5}[a-z]? (?:[nsew]\\.? )?[a-z][a-z']{0,30}(?: [a-z][a-z']{0,30}){0,3} (?:street|avenue|boulevard|terrace)\\b\\.?${UNIT}`, "gi");
const PO_BOX = /\bP\.? ?O\.? Box \d{1,8}\b/gi;

// words that sit next to a name without being part of it
const NOT_A_NAME = new Set(["jr", "sr", "ii", "iii", "iv", "phd", "mba", "md", "cpa", "the", "and", "van", "von", "der", "del", "des"]);

// escapes a string so it can be searched for as is
function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// finds a piece of text only where it stands on its own, not inside a longer word
function wholeWord(text: string, flags: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped(text)}(?![\\p{L}\\p{N}])`, `${flags}u`);
}

// true for a run of digits that is long enough to be a phone number and is not a pair of years like 2019 - 2023
function looksLikePhone(match: string): boolean {
  const digits = match.replace(/\D/g, "").length;
  if (digits < (match.trimStart().startsWith("+") ? 8 : 9) || digits > 15) return false;
  const years = match.split(/\D+/).filter((part) => /^(?:19|20)\d{2}$/.test(part)).length;
  return years < 2;
}

// the ways a first or last name can show up by itself: as written, capitalised and in capitals
function nameForms(name: string): string[] {
  const parts = name
    .split(/\s+/)
    .flatMap((part) => [part, ...part.split("-")])
    .map((part) => part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))
    .filter((part) => part.replace(/[^\p{L}]/gu, "").length >= 3 && !NOT_A_NAME.has(part.toLowerCase()));
  return [...new Set(parts.flatMap((part) => [part, part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(), part.toUpperCase()]))];
}

// takes names, emails, phones, addresses, links and birth dates out of text before it leaves the app.
// it is a best effort: it knows the usual shapes of these details, and the name, city and links we read off the resume
export function redactor(contact?: Partial<ResumeContact> | null): Redactor {
  const swaps: [placeholder: string, original: string][] = [];
  let counter = 0;

  // replaces every match with a numbered placeholder and remembers what was there
  const swap = (input: string, pattern: RegExp, label: string, wanted: (match: string) => boolean = () => true): string =>
    input.replace(pattern, (match) => {
      if (!wanted(match)) return match;
      const known = swaps.find(([, original]) => original === match);
      if (known) return known[0];
      counter += 1;
      const placeholder = `[${label}_${counter}]`;
      swaps.push([placeholder, match]);
      return placeholder;
    });

  const name = contact?.name?.trim() ?? "";
  // the person's own links, which can be a bare address like someone.dev that no pattern would spot
  const links = [contact?.linkedin, contact?.github, ...(contact?.links ?? [])].filter((link): link is string => !!link && link.trim().length > 3);

  const hide = (text: string): string => {
    let result = text;
    // links first, so the email and phone patterns do not chew pieces out of them
    result = swap(result, URL, "LINK");
    for (const link of links) result = swap(result, new RegExp(escaped(link.trim()), "gi"), "LINK");
    result = swap(result, HANDLE, "LINK");
    result = swap(result, EMAIL, "EMAIL");
    result = swap(result, BIRTH, "BIRTH");
    result = swap(result, ID_NUMBER, "ID");
    result = swap(result, PHONE, "PHONE", looksLikePhone);
    result = swap(result, STREET, "ADDRESS");
    result = swap(result, STREET_ANY_CASE, "ADDRESS");
    result = swap(result, PO_BOX, "ADDRESS");
    // the name and city come from what we already read off the resume
    if (name.length > 2) {
      // the whole name in any case, then each part of it wherever it is written like a name
      result = swap(result, wholeWord(name, "gi"), "NAME");
      for (const form of nameForms(name)) result = swap(result, wholeWord(form, "g"), "NAME");
    }
    if (contact?.location) result = swap(result, new RegExp(escaped(contact.location), "g"), "ADDRESS");
    return result;
  };

  return {
    hide,
    // puts the real details back, longest placeholder first so [NAME_1] never eats part of [NAME_10]
    restore: (output) => [...swaps].sort((a, b) => b[0].length - a[0].length).reduce((restored, [placeholder, original]) => restored.split(placeholder).join(original), output),
  };
}

// hides the personal details in one piece of text
export function redact(text: string, contact?: Partial<ResumeContact> | null): Redacted {
  const hidden = redactor(contact);
  return { text: hidden.hide(text), restore: hidden.restore };
}
