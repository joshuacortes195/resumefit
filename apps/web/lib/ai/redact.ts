import type { ResumeContact } from "@resumefit/scoring";

// text with the personal details swapped out, and a way to put them back
export type Redacted = {
  text: string;
  restore: (text: string) => string;
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
const URL = /(?:https?:\/\/|www\.)[^\s,;|)]+|\b(?:linkedin\.com|github\.com)\/[^\s,;|)]+/gi;
const STREET = /\b\d{1,5} [A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)* (?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b\.?(?:,? (?:Apt|Unit|Suite|#) ?\w+)?/g;

// escapes a string so it can be searched for as is
function literal(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
}

// takes names, emails, phones, addresses and links out of text before it leaves the app
export function redact(text: string, contact?: Partial<ResumeContact> | null): Redacted {
  const swaps: [placeholder: string, original: string][] = [];
  let counter = 0;

  // replaces every match with a numbered placeholder and remembers what was there
  const hide = (input: string, pattern: RegExp, label: string): string =>
    input.replace(pattern, (match) => {
      const known = swaps.find(([, original]) => original === match);
      if (known) return known[0];
      counter += 1;
      const placeholder = `[${label}_${counter}]`;
      swaps.push([placeholder, match]);
      return placeholder;
    });

  let result = text;
  // links first, so the email and phone patterns do not chew pieces out of them
  result = hide(result, URL, "LINK");
  result = hide(result, EMAIL, "EMAIL");
  result = hide(result, PHONE, "PHONE");
  result = hide(result, STREET, "ADDRESS");
  // the name and city come from what we already read off the resume
  if (contact?.name && contact.name.trim().length > 2) result = hide(result, literal(contact.name.trim()), "NAME");
  if (contact?.location) result = hide(result, literal(contact.location), "ADDRESS");

  return {
    text: result,
    // puts the real details back, longest placeholder first so [NAME_1] never eats part of [NAME_10]
    restore: (output) => [...swaps].sort((a, b) => b[0].length - a[0].length).reduce((restored, [placeholder, original]) => restored.split(placeholder).join(original), output),
  };
}
