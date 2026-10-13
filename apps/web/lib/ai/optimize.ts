import { parseResume, countSkills } from "@resumefit/scoring";
import { BULLETS_SYSTEM, bulletsPrompt, bulletsSchema, OPTIMIZE_SYSTEM, optimizePrompt, suggestionsSchema, type Suggestion } from "@/lib/ai/prompts/optimize";
import { tidy } from "@/lib/ai/prompts/style";
import { redact } from "@/lib/ai/redact";
import { generateJSON, type GenerateOptions } from "@/lib/ai/router";
import type { SavedScan } from "@/lib/data/scans";

// the resume as the list of lines the workspace edits
export function resumeLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trimEnd());
}

// throws away suggestions that break the rules, and decides ourselves which ones need a yes from the user
export function vetSuggestions(raw: Suggestion[], lines: string[], resumeText: string): Suggestion[] {
  const seen = new Set<number>();
  const kept: Suggestion[] = [];
  for (const suggestion of raw) {
    const line = lines[suggestion.target_ref];
    const proposed = tidy(suggestion.proposed);
    // the change has to point at a real line that still reads the way the model says it does
    if (line === undefined || line.trim() === "" || seen.has(suggestion.target_ref)) continue;
    if (line.trim() !== suggestion.original.trim() || proposed === "" || proposed === line.trim()) continue;
    seen.add(suggestion.target_ref);

    // only count keywords that really are in the new line
    const added = suggestion.keywords_added.filter((keyword) => countSkills(proposed, [{ name: keyword }]).size > 0);
    // a keyword that is nowhere in the resume is a new claim, so the person has to confirm it
    const isNewClaim = added.some((keyword) => countSkills(resumeText, [{ name: keyword }]).size === 0);
    kept.push({ ...suggestion, id: `s${kept.length + 1}`, original: line, proposed, keywords_added: added, requires_user_confirmation: suggestion.type === "skills" || isNewClaim });
  }
  return kept;
}

// asks for edit suggestions for a scan, with personal details hidden on the way out and restored on the way back
export async function suggestEdits(scan: SavedScan, options: GenerateOptions): Promise<Suggestion[]> {
  const text = scan.resumeTextSnapshot;
  const redacted = redact(text, scan.report.resume.contact);
  const lines = resumeLines(redacted.text);
  const skills = [...scan.report.hardSkills, ...scan.report.softSkills];

  const reply = await generateJSON(
    "optimize",
    {
      system: OPTIMIZE_SYSTEM,
      prompt: optimizePrompt({
        lines,
        jobTitle: scan.report.jobTitle,
        missing: skills.filter((skill) => skill.match !== "exact").map((skill) => skill.name),
        present: skills.filter((skill) => skill.match === "exact").map((skill) => skill.name),
        jdSummary: redact(scan.jdText.slice(0, 6000)).text,
      }),
    },
    suggestionsSchema,
    options,
  );

  // put the real details back before checking against the real lines
  const restored = reply.suggestions.map((suggestion) => ({ ...suggestion, original: redacted.restore(suggestion.original), proposed: redacted.restore(suggestion.proposed) }));
  return vetSuggestions(restored, resumeLines(text), text);
}

// asks for three bullet options that use one keyword, based on one job from the resume
export async function suggestBullets(input: { resumeText: string; keyword: string; entryIndex: number; jobTitle: string | null }, options: GenerateOptions): Promise<string[]> {
  const parsed = parseResume(input.resumeText);
  const entry = parsed.experience[input.entryIndex] ?? parsed.experience[0];
  const entryText = entry ? [`${entry.title ?? ""}, ${entry.company ?? ""}`, ...entry.bullets.map((bullet) => `- ${bullet}`)].join("\n") : input.resumeText.slice(0, 2000);
  const redacted = redact(entryText, parsed.contact);

  const reply = await generateJSON("bullets", { system: BULLETS_SYSTEM, prompt: bulletsPrompt({ keyword: input.keyword, entry: redacted.text, jobTitle: input.jobTitle }) }, bulletsSchema, { ...options, fast: true });
  return reply.options
    .map((option) => tidy(redacted.restore(option)).replace(/^[•\-*]\s*/, ""))
    .filter((option) => option.length > 0)
    .slice(0, 3);
}
