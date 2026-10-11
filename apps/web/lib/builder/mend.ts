import type { BuilderData } from "@/lib/builder/types";

// puts back together a builder resume that was filled in by the old reader: a company that became a job of its own,
// a group label that became a skill, and a skill that was cut in two at a comma inside brackets
export function mendBuilder(data: BuilderData): BuilderData {
  const experience: BuilderData["experience"] = [];
  for (const job of data.experience) {
    const last = experience.at(-1);
    const orphan = !job.company.trim() && !job.start.trim() && !job.end.trim() && !job.current && job.bullets.filter((bullet) => bullet.trim()).length === 0;
    // "Ormco (Envista" on its own, right after a job that has a title and dates but no company
    if (orphan && last && !last.company.trim()) {
      const open = (job.title.match(/\(/g) ?? []).length - (job.title.match(/\)/g) ?? []).length;
      last.company = job.title.trim() + ")".repeat(Math.max(0, open));
      if (!last.location.trim()) last.location = job.location;
      continue;
    }
    experience.push({ ...job });
  }
  const skills: string[] = [];
  for (const raw of data.skills) {
    // "Data & Tools: AWS (S3" loses its label
    const skill = raw.replace(/^[A-Za-z][A-Za-z &/,+-]{0,40}:\s*/, "").trim();
    // a label only survived when it had a comma in it, like "Cloud, Data & Tools:", so the plain word just before it is the label's first half
    if (skill !== raw.trim() && /^[A-Z][a-z]+$/.test(skills.at(-1) ?? "")) skills.pop();
    const last = skills.at(-1);
    // "AWS (S3" and "Lambda)" are one skill
    if (last && (last.match(/\(/g) ?? []).length > (last.match(/\)/g) ?? []).length && /\)/.test(skill)) skills[skills.length - 1] = `${last}, ${skill}`;
    else if (skill) skills.push(skill);
  }
  return { ...data, experience, skills };
}
