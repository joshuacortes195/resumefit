// splits what someone typed, like "Software Engineer Intern for Google", into the job and the company
export function parseTarget(typed: string): { jobTitle: string; company: string } {
  const text = typed.trim().replace(/\s+/g, " ");
  // "at" and "@" are the clearest signs, then "for" and "with", then a dash or a comma. the last one in the text wins
  for (const divider of [/\s+(?:at|@)\s+|\s*@\s*/gi, /\s+(?:for|with)\s+/gi, /\s+[-–|]\s+|,\s+/g]) {
    const last = [...text.matchAll(divider)].at(-1);
    if (last && last.index > 0 && last.index + last[0].length < text.length) return { jobTitle: text.slice(0, last.index).trim(), company: text.slice(last.index + last[0].length).trim() };
  }
  return { jobTitle: text, company: "" };
}
