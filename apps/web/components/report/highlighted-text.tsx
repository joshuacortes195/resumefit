import type { SkillSpan } from "@resumefit/scoring";
import type { SkillMatch } from "@resumefit/shared";

type HighlightedTextProps = {
  text: string;
  spans: SkillSpan[];
  skills: SkillMatch[];
  // the resume side only marks what was found, the job side marks everything
  only?: "found";
};

// the look of each kind of mark, found is a highlighter stroke, missing is a dashed outline
const MARKS: Record<SkillMatch["match"], string> = {
  exact: "rounded-sm bg-marker px-0.5 text-on-marker",
  related: "rounded-sm bg-transparent px-0.5 text-inherit underline decoration-warning decoration-wavy decoration-2 underline-offset-4",
  missing: "rounded-sm bg-transparent px-0.5 text-inherit outline-1 outline-dashed outline-danger",
};

// what a screen reader says before each kind of mark
const SPOKEN: Record<SkillMatch["match"], string> = { exact: "Found: ", related: "Similar term found: ", missing: "Missing: " };

// shows a resume or job description with its skills marked up
export function HighlightedText({ text, spans, skills, only }: HighlightedTextProps) {
  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const span of spans) {
    const skill = byName.get(span.name);
    // skip marks we do not want here and anything that overlaps the one before
    if (!skill || span.start < cursor || (only === "found" && skill.match !== "exact")) continue;
    parts.push(text.slice(cursor, span.start));
    parts.push(
      <mark
        key={span.start}
        className={MARKS[skill.match]}
        title={skill.resumeCount > 0 ? `In your resume ${skill.resumeCount} ${skill.resumeCount === 1 ? "time" : "times"}` : skill.match === "related" ? "A similar term is in your resume" : "Not in your resume"}
      >
        <span className="sr-only">{SPOKEN[skill.match]}</span>
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  }
  parts.push(text.slice(cursor));

  return <div className="whitespace-pre-wrap text-sm leading-7">{parts}</div>;
}

// explains the three kinds of mark
export function HighlightLegend({ only }: { only?: "found" }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      <li>
        <span className={MARKS.exact}>Skill</span> in your resume
      </li>
      {!only && (
        <>
          <li>
            <span className={`text-foreground ${MARKS.missing}`}>Skill</span> missing
          </li>
          <li>
            <span className={`text-foreground ${MARKS.related}`}>Skill</span> similar term found
          </li>
        </>
      )}
    </ul>
  );
}
