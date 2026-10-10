import { BULLETS_TASK, OPTIMIZE_TASK } from "@/lib/ai/prompts/optimize";
import { COVER_LETTER_TASK, THANK_YOU_TASK } from "@/lib/ai/prompts/letters";
import type { ProviderCall } from "@/lib/ai/providers";

// a stand in provider for the browser tests, it answers from fixed rules so the tests never need a real key
export const mockCall: ProviderCall = async ({ system, prompt }) => {
  let text = "ready";

  if (system.startsWith(OPTIMIZE_TASK)) {
    // read the numbered resume lines back out of the request
    const lines = [...prompt.matchAll(/^(\d+)\| (.*)$/gm)].map((hit) => ({ index: Number(hit[1]), text: hit[2] ?? "" }));
    const missing = (prompt.match(/most important first:\n(.*)/)?.[1] ?? "").split(", ").filter((word) => word && word !== "none");
    const bullets = lines.filter((line) => /^[•-]/.test(line.text));
    // the line right under the skills heading
    const skills = lines[lines.findIndex((line) => /^skills:?$/i.test(line.text.trim())) + 1];
    const suggestions = [];
    if (bullets[0] && missing[0]) {
      suggestions.push({ id: "s1", section: "Experience", target_ref: bullets[0].index, original: bullets[0].text, proposed: `${bullets[0].text.replace(/[.]$/, "")} using ${missing[0]}`, keywords_added: [missing[0]], type: "bullet", requires_user_confirmation: false });
    }
    if (bullets[1]) {
      suggestions.push({ id: "s2", section: "Experience", target_ref: bullets[1].index, original: bullets[1].text, proposed: `${bullets[1].text.replace(/[.]$/, "")}, improving results by [X%]`, keywords_added: [], type: "metric", requires_user_confirmation: false });
    }
    if (skills && skills.text.trim() && !/^skills:?$/i.test(skills.text.trim()) && lines.some((line) => /^skills:?$/i.test(line.text.trim())) && missing[1]) {
      suggestions.push({ id: "s3", section: "Skills", target_ref: skills.index, original: skills.text, proposed: `${skills.text}, ${missing[1]}`, keywords_added: [missing[1]], type: "skills", requires_user_confirmation: false });
    }
    text = JSON.stringify({ suggestions });
  } else if (system.startsWith(BULLETS_TASK)) {
    const keyword = prompt.match(/Keyword to include: (.*)/)?.[1] ?? "the skill";
    text = JSON.stringify({ options: [`Built [N] features with ${keyword} for the product team`, `Used ${keyword} to cut review time by [X%]`, `Taught ${keyword} basics to [N] teammates`] });
  } else if (system.startsWith(COVER_LETTER_TASK)) {
    const company = prompt.match(/Company: (.*)/)?.[1] ?? "your company";
    const title = prompt.match(/Job title: (.*)/)?.[1] ?? "this role";
    text = `Dear Hiring Manager,\n\nThe ${title} role at ${company} lines up with the work I have been doing.\n\nI would welcome the chance to talk.\n\nSincerely,\nThe applicant`;
  } else if (system.startsWith(THANK_YOU_TASK)) {
    const interviewer = prompt.match(/Interviewer: (.*)/)?.[1] ?? "there";
    text = `Hi ${interviewer},\n\nThank you for the conversation today. I am still very interested in the role.\n\nBest,\nThe applicant`;
  }
  else if (system.startsWith("Task: write linkedin headlines.")) {
    text = JSON.stringify({ options: ["Data Analyst | SQL and Tableau | Healthcare", "Data Analyst turning messy data into clear answers", "SQL and Tableau analyst for care teams"] });
  } else if (system.startsWith("Task: write a linkedin about section.")) {
    text = "I am a data analyst who helps care teams decide faster.\n\nI am looking for my next analytics role.";
  } else if (system.startsWith("Task: write interview questions.")) {
    const types = ["behavioral", "technical", "resume", "behavioral", "technical", "resume", "behavioral", "technical"];
    text = JSON.stringify({ questions: types.map((type, index) => ({ type, question: `Practice question ${index + 1}: tell me about your work as it relates to this job.` })) });
  } else if (system.startsWith("Task: give interview feedback.")) {
    text = JSON.stringify({ score: 72, star: { situation: true, task: true, action: true, result: false }, relevance: "It fits the role.", specificity: "Add a number.", improve: ["Say what the result was."], sample_answer: "At my last job I led the migration and cut load time by [X%]." });
  } else if (system.startsWith("Task: answer an application question.")) {
    text = "I enjoy this kind of work and have done it before. [Add a specific example here.]";
  } else if (system.startsWith("You turn a person's short description")) {
    text = JSON.stringify({ bullets: ["Served [N] customers a day at a busy counter", "Trained [N] new team members on the register"] });
  } else if (system.startsWith("You list the skills")) {
    text = JSON.stringify({ skills: ["Inventory Management", "SAP", "Excel", "Forecasting", "SQL", "Communication"] });
  } else if (system.startsWith("You write the summary")) {
    text = "Frontend engineer with four years of experience building fast, accessible web apps.";
  }
  return { text, tokensIn: 1, tokensOut: 1 };
};
