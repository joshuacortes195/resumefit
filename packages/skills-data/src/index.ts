// starter skill lists, the full taxonomy build comes with the scoring milestone

export type SkillEntry = {
  name: string;
  // other spellings that count as the same skill
  aliases?: string[];
  // close cousins that only get half credit
  related?: string[];
};

// small seed of hard skills so the matcher has something to chew on
export const HARD_SKILLS: SkillEntry[] = [
  { name: "JavaScript", aliases: ["JS", "ECMAScript"] },
  { name: "TypeScript", aliases: ["TS"] },
  { name: "Python" },
  { name: "Java" },
  { name: "C++" },
  { name: "C#" },
  { name: ".NET", aliases: ["dotnet"] },
  { name: "Go", aliases: ["Golang"] },
  { name: "SQL" },
  { name: "PostgreSQL", aliases: ["Postgres"], related: ["SQL"] },
  { name: "MySQL", related: ["SQL"] },
  { name: "React", aliases: ["React.js", "ReactJS"] },
  { name: "Next.js", aliases: ["NextJS"] },
  { name: "Node.js", aliases: ["NodeJS", "Node"] },
  { name: "Amazon Web Services", aliases: ["AWS"] },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "Docker" },
  { name: "CI/CD", aliases: ["continuous integration", "continuous delivery"] },
  { name: "Machine Learning", aliases: ["ML"] },
  { name: "Object-oriented design", aliases: ["OOD"], related: ["object oriented programming", "OOP"] },
  { name: "Git" },
  { name: "REST APIs", aliases: ["REST", "RESTful"] },
  { name: "Excel", aliases: ["Microsoft Excel"] },
  { name: "Distributed Systems" },
];

// small seed of soft skills
export const SOFT_SKILLS: SkillEntry[] = [
  { name: "Communication", aliases: ["verbal communication skills", "communicate effectively"] },
  { name: "Problem solving", aliases: ["solve complex problems"] },
  { name: "Leadership" },
  { name: "Collaboration", aliases: ["teamwork"] },
  { name: "Time management" },
  { name: "Attention to detail" },
  { name: "Constructive feedback" },
  { name: "Sound judgement", aliases: ["sound judgment"] },
  { name: "Troubleshooting" },
  { name: "Customer-facing" },
];
