// builds src/onet-skills.json from the O*NET "Technology Skills" file.
// run it with: pnpm --filter @resumefit/skills-data build:skills
//
// O*NET data is published by the U.S. Department of Labor under CC BY 4.0. see the README for the attribution.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CURATED_HARD_SKILLS, SOFT_SKILLS } from "../src/curated.ts";

// which release to fetch, bump this when a new one comes out
const RELEASE = "30_0";
const SOURCE = `https://www.onetcenter.org/dl_files/database/db_${RELEASE}_text/Technology%20Skills.txt`;

// company names that sit in front of a product, "Microsoft Excel" is also just "Excel" on most resumes
const VENDORS = ["Microsoft", "Adobe", "Apple", "Google", "Oracle", "IBM", "SAP", "Amazon", "Atlassian", "Autodesk", "Apache", "Salesforce", "Intuit", "Cisco", "Symantec", "Corel", "Citrix", "VMware", "Red Hat", "Epic Systems", "The MathWorks"];

// product names that are also everyday words. on their own they would match ordinary sentences, so they are only kept with their vendor in front
const EVERYDAY = new Set(
  `access word office teams project outlook drive docs maps analytics cloud sheets slides forms meet calendar photos pages numbers keynote notes mail contacts
  windows exchange publisher visio word edge bing azure dynamics premiere illustrator acrobat reader flash bridge audition animate dimension fresco express
  focus compass indeed monday notion canvas blackboard slack zoom box buffer later loom miro mural notability things bear spark chef puppet salt consul vault
  nomad packer ant maven gradle make bash shell go swift rust ruby python java scala dart julia lisp scheme basic pascal ada crystal elm reason hack logo
  sage stata minitab origin matlab maple magma maxima oracle sybase informix progress paradox approach filemaker base query report writer designer builder
  studio suite center manager server client desktop mobile online web portal console monitor viewer editor explorer navigator finder safari chrome opera
  firefox brave vivaldi tor signal telegram discord skype viber line wire element matrix mattermost rocket flock chanty ryver twist fleep glip workplace
  facebook instagram twitter pinterest snapchat tiktok youtube vimeo twitch reddit tumblr medium quora yelp nextdoor meetup eventbrite classroom
  square stripe venmo cash wave sage xero zoho freshbooks bench gusto rippling deel remote justworks trinet paychex adp workday kronos ceridian paylocity
  epic cerner meditech allscripts athena practice fusion kareo nextgen greenway eclinicalworks centricity soarian sunrise paragon expanse
  relativity concordance summation casemap timemap sanction trialdirector clio mycase practicepanther smokeball rocketmatter cosmolex
  act goldmine maximizer sugar insightly nimble capsule copper close pipedrive streak nutshell keap infusionsoft ontraport drip convertkit
  apex flow lightning einstein tableau looker domo sisense qlik spotfire cognos hyperion essbase planning budget forecast ledger journal
  mint quicken money banktivity moneydance personal capital ynab pocketguard goodbudget everydollar wally spendee
  blender maya houdini nuke fusion flame smoke lustre resolve avid premiere vegas edius lightworks shotcut openshot kdenlive
  revit rhino grasshopper dynamo navisworks tekla etabs staad safe sap robot ram risa enercalc mathcad
  pro tools logic live reason cubase nuclear studio one reaper audacity garageband sibelius finale dorico musescore
  prism graphpad origin sigma plot igor kaleidagraph
  email internet intranet spreadsheet database software hardware network`.split(/\s+/),
);

// the system word list, used to throw out product names that are also plain english words like "Connect" or "Director".
// it is only needed when rebuilding the list, on a mac or linux machine
const WORDS = "/usr/share/dict/words";
if (!existsSync(WORDS)) throw new Error(`This script needs the word list at ${WORDS} to filter out everyday words.`);
const dictionary = new Set(readFileSync(WORDS, "utf8").toLowerCase().split("\n"));

// tidies a name the way it was typed into the database
function clean(name: string): string {
  return name.replace(/\s+/g, " ").replace(/[“”]/g, '"').trim();
}

// true when a name is safe to look for on its own in running text
function usable(name: string): boolean {
  if (name.length < 2 || name.length > 50 || name.split(" ").length > 5) return false;
  // generic categories like "Accounting software" are not something people list
  if (/ software$| systems?$| tools?$| programs?$| applications?$/i.test(name) && name === name.toLowerCase().replace(/^./, (first) => first.toUpperCase())) return false;
  if (name.includes(" ")) return true;
  // a single word must not be an everyday word, since we look for it in running text without caring about capitals
  if (EVERYDAY.has(name.toLowerCase()) || dictionary.has(name.toLowerCase())) return false;
  // and it has to look like a product: a capital in the middle, a digit or a symbol, or at least be a long made up word
  return /[A-Z].*[A-Z]|\d|[+#./-]/.test(name) || name.length >= 6;
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Could not download ${SOURCE}: ${response.status}`);
const rows = (await response.text()).split(/\r?\n/).slice(1);

// how many occupations use each technology, and whether O*NET marks it as hot or in demand
const seen = new Map<string, { name: string; jobs: number; hot: boolean }>();
for (const row of rows) {
  const [, example, , , hot, inDemand] = row.split("\t");
  if (!example) continue;
  const name = clean(example);
  const entry = seen.get(name.toLowerCase()) ?? { name, jobs: 0, hot: false };
  entry.jobs += 1;
  entry.hot ||= hot === "Y" || inDemand === "Y";
  seen.set(name.toLowerCase(), entry);
}

// every spelling the hand picked lists already cover, so nothing is listed twice
const taken = new Set([...CURATED_HARD_SKILLS, ...SOFT_SKILLS].flatMap((skill) => [skill.name, ...(skill.aliases ?? [])]).map((name) => name.toLowerCase()));

const skills: { name: string; aliases?: string[] }[] = [];
// the most widely used ones first, so they win when two names would share a short form
for (const { name } of [...seen.values()].sort((a, b) => Number(b.hot) - Number(a.hot) || b.jobs - a.jobs || a.name.localeCompare(b.name))) {
  const lower = name.toLowerCase();
  if (taken.has(lower) || !usable(name)) continue;

  // "Microsoft Power BI" is also found as "Power BI", unless the short form is an everyday word or already in use
  const vendor = VENDORS.find((entry) => lower.startsWith(`${entry.toLowerCase()} `));
  const short = vendor ? name.slice(vendor.length + 1) : null;
  // when the short form is already in the hand picked list, that entry covers this product
  if (short && taken.has(short.toLowerCase())) continue;
  const alias = short && usable(short) && !EVERYDAY.has(short.toLowerCase()) && (short.includes(" ") || !EVERYDAY.has(short.toLowerCase())) ? short : null;

  taken.add(lower);
  if (alias) taken.add(alias.toLowerCase());
  skills.push(alias ? { name, aliases: [alias] } : { name });
}

skills.sort((a, b) => a.name.localeCompare(b.name));
const out = path.join(import.meta.dirname, "../src/onet-skills.json");
writeFileSync(out, `${JSON.stringify(skills)}\n`);
console.log(`Wrote ${skills.length} skills from O*NET ${RELEASE.replace("_", ".")} to ${path.relative(process.cwd(), out)}`);
