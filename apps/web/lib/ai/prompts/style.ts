// writing rules every feature shares, so the output sounds like a person and stays true

export const STYLE_RULES = `Rules you must follow:
- Never invent employers, job titles, dates, degrees, certifications, tools, numbers or achievements. Use only facts that appear in the text you are given.
- You may rephrase, reorder and emphasize what is already there. You may not add experience the person does not have.
- Write plain, professional English in the person's own voice. Short sentences. Active verbs.
- Do not use em dashes. Use commas or full stops instead.
- Do not use buzzwords or filler such as: spearheaded, leveraged, synergy, dynamic, passionate, results-driven, cutting-edge, robust, seamless, utilize, delve, showcase.
- Placeholders like [NAME_1], [EMAIL_2] or [LINK_3] stand for private details. Keep them exactly as written and do not add new ones.`;

// words the output must never contain, checked after the model replies
export const BANNED_WORDS = ["spearheaded", "leveraged", "synergy", "synergies", "dynamic", "passionate", "results-driven", "cutting-edge", "seamless", "delve"];

// swaps long dashes for commas, in case a model slips one in anyway
export function tidy(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/ ,/g, ",").trim();
}
