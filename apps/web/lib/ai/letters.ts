import type { ResumeContact } from "@resumefit/scoring";
import { coverLetterPrompt, coverLetterSystem, THANK_YOU_SYSTEM, thankYouPrompt, type Length, type Tone } from "@/lib/ai/prompts/letters";
import { tidy } from "@/lib/ai/prompts/style";
import { redact } from "@/lib/ai/redact";
import { generateText, type GenerateOptions } from "@/lib/ai/router";

// openers we never want, a letter that starts with one gets it cut off
const STALE_OPENERS = /^(?:I am writing to express my (?:strong |keen )?interest[^.]*\.\s*|I am excited to apply[^.]*\.\s*)/i;

// writes a cover letter from a resume and a job description
export async function writeCoverLetter(
  input: { resume: string; contact: Partial<ResumeContact> | null; jdText: string; jobTitle: string | null; company: string | null; tone: Tone; length: Length; why?: string; manager?: string },
  options: GenerateOptions,
): Promise<string> {
  const redacted = redact(input.resume, input.contact);
  const letter = await generateText("cover-letter", { system: coverLetterSystem(input.tone, input.length), prompt: coverLetterPrompt({ ...input, resume: redacted.text }) }, options);
  // tidy the dashes, drop a stale opener if one slipped in, then put the person's details back
  const [greeting = "", ...rest] = tidy(letter).split(/\n\s*\n/);
  const body = rest.join("\n\n").replace(STALE_OPENERS, "");
  return redacted.restore([greeting, body].filter(Boolean).join("\n\n"));
}

// writes a short thank-you email for after an interview
export async function writeThankYou(input: { jobTitle: string; company: string | null; type: string; interviewer: string | null; notes: string | null; name: string | null }, options: GenerateOptions): Promise<string> {
  // names never leave the app, and neither do contact details someone typed into their notes
  const notes = redact(input.notes ?? "", { name: input.name });
  const note = await generateText(
    "thank-you",
    {
      system: THANK_YOU_SYSTEM,
      prompt: thankYouPrompt({ ...input, interviewer: input.interviewer ? "[INTERVIEWER]" : null, name: input.name ? "[APPLICANT]" : null, notes: input.notes ? notes.text : null }),
    },
    { ...options, fast: true },
  );
  return notes
    .restore(tidy(note))
    .split("[INTERVIEWER]")
    .join(input.interviewer ?? "")
    .split("[APPLICANT]")
    .join(input.name ?? "");
}
