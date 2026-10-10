import type { FieldKey } from "./types";

// the ways forms ask for each thing. order matters: the first pattern that fits wins, so the specific ones come first
export const FIELD_PATTERNS: [FieldKey, RegExp][] = [
  // demographic questions first, so "gender" is never mistaken for something else
  ["eeoGender", /\bgender\b|\bsex\b/],
  // asked on its own on many forms, apart from race
  ["eeoHispanic", /hispanic|latino|latinx/],
  ["eeoRace", /\brace\b|ethnic/],
  ["eeoVeteran", /veteran/],
  ["eeoDisability", /disabilit/],
  ["pronouns", /pronoun/],
  ["over18", /at least 18|18 years( of age)? or older|18 or older|over (the age of )?18|of legal age/],
  ["sponsorship", /sponsor|visa status|require.*(visa|h-?1b)/],
  ["workAuthorization", /authori[sz]ed to work|work authori[sz]ation|legally (authori[sz]ed|eligible|able|permitted)|eligible to work|right to work/],
  ["relocation", /relocat/],
  ["howHeard", /how did you (hear|find|learn)|where did you (hear|find)|referral source|source of (application|referral)/],
  ["resume", /resume|résumé|\bcv\b|curriculum vitae/],
  ["coverLetter", /cover letter/],
  ["linkedin", /linkedin/],
  ["github", /github/],
  ["website", /website|portfolio|personal (site|url|page)|\bblog\b|other (url|link)/],
  ["preferredName", /preferred (first )?name|nickname|what should we call you/],
  ["firstName", /first name|given name|forename|\bfname\b|firstname/],
  ["lastName", /last name|family name|surname|\blname\b|lastname/],
  ["fullName", /full name|legal name|your name|^name$|\bname\b/],
  ["email", /e-?mail/],
  ["phone", /phone|mobile|\btel\b|telephone|cell/],
  // school questions, the narrow ones first so "school" does not swallow them
  ["gpa", /\bgpa\b|grade point/],
  ["graduationYear", /graduation (year|date)|year of graduation|(expected|anticipated) graduation|graduat(ed|ing) in/],
  ["major", /\bmajor\b|field of study|area of study|discipline/],
  ["degree", /\bdegree\b|level of education|education level/],
  ["school", /\bschool\b|university|college|institution/],
  ["address", /street address|address line 1|address 1|mailing address|^address$/],
  ["zip", /\bzip\b|postal|postcode/],
  ["city", /\bcity\b|\btown\b/],
  ["state", /\bstate\b|province|\bregion\b/],
  ["country", /country/],
  ["location", /location|where are you (based|located)|current address|^address/],
  ["currentCompany", /current (company|employer)|present employer|^company$|^employer$|\borg(ani[sz]ation)?\b/],
  ["currentTitle", /current (title|role|position)|job title|^title$/],
  // only the total, never "years of experience with sql", which we cannot know
  ["yearsExperience", /(total )?years of (relevant |professional |work |total )?experience(?! (do you have )?(with|in|using|as)\b)|experience \(years\)/],
  ["salary", /salary|compensation|pay (expectation|range|rate)|desired pay|expected (ctc|pay)/],
  ["startDate", /start date|available to start|when can you start|availability|notice period/],
];

// what browsers call these fields in the autocomplete attribute, the most reliable hint when it is there
export const AUTOCOMPLETE: Record<string, FieldKey> = {
  "given-name": "firstName",
  "family-name": "lastName",
  name: "fullName",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "address-level2": "city",
  "address-level1": "state",
  "postal-code": "zip",
  country: "country",
  "country-name": "country",
  organization: "currentCompany",
  "organization-title": "currentTitle",
  url: "website",
};

// tidies a label so the patterns can be run on it
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_\-[\].]+/g, " ")
    .replace(/[*:?()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// works out what a field is asking for from the words around it
export function matchKey(texts: string[]): FieldKey | null {
  for (const raw of texts) {
    const text = normalize(raw);
    if (!text) continue;
    for (const [key, pattern] of FIELD_PATTERNS) if (pattern.test(text)) return key;
  }
  return null;
}

// answers that mean "I would rather not say", used for demographic questions
export const DECLINE_PATTERN = /decline|prefer not|(don.t|do not) (wish|want)|not to (say|answer|disclose|identify)|choose not|rather not/i;
