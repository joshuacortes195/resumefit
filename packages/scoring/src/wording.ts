import type { SkillTerm } from "./match";

// lowercases a skill name and evens out hyphens and spacing, so "Front-end frameworks" and "frontend frameworks" look the same
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‐-―-]/g, " ")
    .replace(/\bfront end\b/g, "frontend")
    .replace(/\bback end\b/g, "backend")
    .replace(/\s+/g, " ")
    .trim();
}

// cuts a word down to its root so owned, owns and ownership all meet at "own", and structures meets structure
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, "");
  if (w.length <= 3) return w;
  if (w.endsWith("ership")) w = w.slice(0, -6);
  else if (w.endsWith("ship")) w = w.slice(0, -4);
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  // "debugg" from debugging goes back to "debug", "plann" to "plan"
  if (/([b-df-hj-km-np-rtv-z])\1$/.test(w) && !/(?:ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  return w;
}

// the words of a text as roots, in order
export function stemWords(text: string): string[] {
  return (text.match(/[A-Za-z0-9+#]+/g) ?? []).map(stem);
}

// words a posting tacks onto a skill that do not change what it is, like "data structure implementation" or "basic algorithm development"
const FILLER_LEAD = new Set(["basic", "strong", "solid", "advanced", "general", "modern", "proven", "deep", "working"]);
const FILLER_TAIL = new Set(["implementation", "implementations", "development", "principles", "concepts", "fundamentals", "techniques", "methodologies", "skills", "knowledge", "experience"]);
// roots that are too broad to stand on their own once the filler is gone, so "software development" is never just "software"
const TOO_BROAD = new Set(["software", "web", "application", "applications", "product", "system", "systems", "business", "game", "mobile", "frontend", "backend", "full", "stack", "data", "design", "solution", "solutions"]);

// the core words of a skill name with the filler taken off
function coreWords(name: string): string[] {
  const words = normalizeName(name).match(/[a-z0-9+#]+/g) ?? [];
  let start = 0;
  let end = words.length;
  while (end - start > 1 && FILLER_LEAD.has(words[start] ?? "")) start++;
  while (end - start > 1 && FILLER_TAIL.has(words[end - 1] ?? "")) end--;
  const core = words.slice(start, end);
  // taking the filler off has to leave something specific behind
  if (core.length < words.length && core.length === 1 && TOO_BROAD.has(core[0] ?? "")) return words;
  return core;
}

// how many times a skill shows up in the resume when word endings are ignored, like "Owned" for Ownership
// or "Data Structures and Algorithms" for "algorithm development". resumeStems comes from stemWords
export function stemCount(skill: SkillTerm, resumeStems: string[]): number {
  let best = 0;
  for (const spelling of [skill.name, ...(skill.aliases ?? [])]) {
    const roots = coreWords(spelling).map(stem);
    // tiny names like Go or C are too easy to hit by accident
    if (roots.length === 0 || spelling.replace(/[^A-Za-z]/g, "").length < 4) continue;
    let found = 0;
    for (let i = 0; i + roots.length <= resumeStems.length; i++) {
      if (roots.every((root, k) => resumeStems[i + k] === root)) found++;
    }
    best = Math.max(best, found);
  }
  return best;
}

// posting phrases that read like skills but are not one, so they never show up as missing
const GENERIC_PHRASES = new Set(
  [
    "general purpose programming language",
    "general purpose programming languages",
    "general purpose language",
    "programming language",
    "programming languages",
    "modern programming language",
    "modern programming languages",
    "design and development",
    "development and design",
    "software solutions",
    "technical solutions",
    "scalable solutions",
    "innovative products",
    "emerging technologies",
    "new technologies",
    "technical discussions",
    "development productivity",
    "best practices",
    "real world setting",
    "high quality solutions",
  ].map(normalizeName),
);

// company culture lines that get mistaken for skills
export const CULTURE_PHRASES = [
  "bias for action",
  "high ownership",
  "extreme ownership",
  "ownership mindset",
  "ownership at every level",
  "low ego",
  "no ego",
  "mission oriented",
  "mission driven",
  "mission focused",
  "naturally curious",
  "curious minds",
  "think big",
  "customer obsession",
  "customer obsessed",
  "operational excellence",
  "culture of learning and mentorship",
  "growth mindset",
  "hungry and humble",
  "scrappy",
  "team first",
  "earn trust",
  "dive deep",
  "invent and simplify",
  "deliver results",
];
const CULTURE_SET = new Set(CULTURE_PHRASES.map(normalizeName));
const CULTURE_PATTERN = new RegExp(`\\b(?:${CULTURE_PHRASES.map((phrase) => phrase.replace(/ /g, "[\\s-]+")).join("|")})\\b`, "gi");

// true when a name is posting filler or a culture line, never a skill to chase
export function isNoise(name: string): boolean {
  const normal = normalizeName(name);
  return GENERIC_PHRASES.has(normal) || CULTURE_SET.has(normal);
}

// blanks out culture lines in the posting, so "high ownership" is not read as the Ownership skill
export function blankCulture(text: string): string {
  return text.replace(CULTURE_PATTERN, (hit) => " ".repeat(hit.length));
}

// the hiring company's own products, like "Lattice OS" after "Anduril's", since nobody outside the company could have them
export function companyProducts(text: string, company: string | null | undefined): string[] {
  const word = company
    ?.replace(/,?\s+(?:inc|llc|ltd|corp|corporation|co|company|industries|technologies|labs|group|holdings|gmbh|plc)\.?$/i, "")
    .trim()
    .split(/\s+/)[0];
  if (!word || word.length < 3) return [];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // the capitalized words right after "Company's" or "Company"
  const product = new RegExp(`\\b${escaped}(?:['’]s)?\\s+((?:[A-Z][A-Za-z0-9]*\\b\\s*){1,3})`, "g");
  return [...text.matchAll(product)].map((hit) => normalizeName(hit[1] ?? "")).filter(Boolean);
}

// true when a skill name is one of those products, or the start of one
export function isCompanyProduct(name: string, products: string[]): boolean {
  const normal = normalizeName(name);
  return products.some((product) => product === normal || product.startsWith(`${normal} `) || normal.startsWith(`${product} `));
}

// broad phrases a posting uses for a kind of tool, and the tools that count for them
const CATEGORY_TOOLS: [phrases: string[], tools: string[]][] = [
  [
    ["frontend frameworks", "frontend framework", "frontend libraries", "javascript frameworks", "javascript framework", "web frameworks", "ui frameworks"],
    ["React", "Next.js", "Vue", "Angular", "Svelte", "SvelteKit", "Nuxt", "Ember", "SolidJS", "Remix"],
  ],
  [["backend frameworks", "backend framework", "web application frameworks"], ["Express", "Django", "Flask", "FastAPI", "Spring", "Spring Boot", ".NET", "ASP.NET", "Rails", "Node.js", "NestJS", "Laravel"]],
  [
    ["cloud infrastructure", "cloud platforms", "cloud platform", "cloud services", "cloud computing", "cloud technologies", "cloud providers", "public cloud"],
    ["AWS", "Amazon Web Services", "Azure", "Microsoft Azure", "Google Cloud", "GCP", "S3", "Lambda", "EC2", "Vercel", "Cloudflare", "Heroku", "Firebase", "DigitalOcean"],
  ],
  [
    ["storage systems", "storage system", "data storage", "cloud storage", "object storage", "storage solutions"],
    ["S3", "Blob Storage", "PostgreSQL", "MySQL", "SQL Server", "MongoDB", "DynamoDB", "Redis", "Cassandra", "SQLite", "Firestore", "HDFS"],
  ],
  [
    ["databases", "database", "database systems", "relational databases", "relational database", "sql databases", "database management", "database technologies"],
    ["PostgreSQL", "Postgres", "MySQL", "SQL Server", "MSSQL", "SQLite", "Oracle", "MongoDB", "DynamoDB", "Redis", "MariaDB", "Cassandra", "Firestore", "Supabase", "SQL"],
  ],
  [["nosql", "nosql databases", "nosql database", "non relational databases"], ["MongoDB", "DynamoDB", "Cassandra", "Redis", "Firestore", "Couchbase", "CouchDB", "Neo4j"]],
  [["version control", "version control systems", "source control", "source code management"], ["Git", "GitHub", "GitLab", "Bitbucket", "SVN", "Mercurial", "Perforce"]],
  [["containerization", "containers", "container technologies", "container orchestration"], ["Docker", "Kubernetes", "Podman", "ECS", "EKS", "OpenShift"]],
  [["scripting languages", "scripting language", "shell scripting", "scripting"], ["Bash", "PowerShell", "Shell", "Python", "Perl", "Ruby", "zsh"]],
  [["machine learning frameworks", "deep learning frameworks", "ml frameworks"], ["PyTorch", "TensorFlow", "scikit-learn", "Keras", "JAX", "ONNX", "XGBoost"]],
];
const CATEGORY_LOOKUP = new Map<string, SkillTerm[]>();
for (const [phrases, tools] of CATEGORY_TOOLS) {
  const terms = tools.map((name) => ({ name }));
  for (const phrase of phrases) CATEGORY_LOOKUP.set(normalizeName(phrase), terms);
}

// the concrete tools that cover a broad phrase like "cloud infrastructure", or null when the name is not one of those phrases
export function categoryTools(name: string): SkillTerm[] | null {
  return CATEGORY_LOOKUP.get(normalizeName(name)) ?? null;
}

// wording that speaks to an ai model instead of a person reading the posting, like "ignore all previous instructions".
// some postings carry it as a trap for bots, and some people paste it in to see what happens
const INSTRUCTION_PATTERNS = [
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|your\s+|the\s+|of\s+)*(?:previous|prior|above|earlier|preceding)?\s*(?:instructions?|rules|prompts?|guidelines)\b/i,
  /\b(?:system\s+(?:prompt|note|message)|(?:note|instructions?|message)\s+(?:to|for)\s+(?:the\s+)?(?:ai|llm|model|grader|assistant|chatbot|language model))\b/i,
  /\bif\s+you\s+are\s+an?\s+(?:ai|llm|large language model|language model|chatbot|bot)\b/i,
  /\b(?:print|reveal|output|repeat|show)\s+(?:your\s+|the\s+)?(?:full\s+|entire\s+)?(?:system\s+prompt|hidden\s+instructions?|api\s+keys?)\b/i,
];

// true when a posting has lines written for an ai model
export function hasInstructions(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text));
}

// blanks out the part of a posting that is written for an ai model, from the sentence that starts it to the end of its paragraph,
// so the skills it names are not read as things the job asks for. the text keeps its length, so positions still line up
export function blankInstructions(text: string): string {
  if (!hasInstructions(text)) return text;
  return text
    .split(/(\n)/)
    .map((line) => {
      // the first sentence in the line that talks to a model, everything after it in the same line goes too
      const sentences = line.split(/(?<=[.!?])\s+/);
      let offset = 0;
      for (const sentence of sentences) {
        const at = line.indexOf(sentence, offset);
        if (hasInstructions(sentence)) return line.slice(0, at) + " ".repeat(line.length - at);
        offset = at + sentence.length;
      }
      return line;
    })
    .join("");
}
