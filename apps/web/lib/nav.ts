import {
  Briefcase,
  Files,
  History,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Mic,
  PenLine,
  Puzzle,
  Search,
  Sparkles,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import type { SectionKey } from "@/lib/sections";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // one line shown on the page until the feature is built
  blurb: string;
  // which color the link wears, missing for plain pages
  section?: SectionKey;
};

// sidebar links, in the order they show up
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "dashboard", blurb: "Your latest scan, tracker counts and next interview in one place." },
  { label: "AI Optimize", href: "/optimize", icon: Sparkles, section: "optimize", blurb: "Get rewrite suggestions and watch your match rate move as you accept them." },
  { label: "AI Cover Letter", href: "/cover-letter", icon: Mail, section: "letter", blurb: "Draft a cover letter from your resume and the job description." },
  { label: "LinkedIn Optimizer", href: "/linkedin", icon: UserSearch, section: "linkedin", blurb: "Score your LinkedIn profile against the jobs you want." },
  { label: "Job Tracker", href: "/tracker", icon: Briefcase, section: "tracker", blurb: "Drag jobs from Saved to Offer and keep notes on each one." },
  { label: "Find Jobs", href: "/jobs", icon: Search, section: "jobs", blurb: "Search open roles and rank them against your resume." },
  { label: "Resume Builder", href: "/builder", icon: PenLine, section: "builder", blurb: "Build a clean resume step by step with templates that parse well." },
  { label: "Resume Manager", href: "/resumes", icon: Files, section: "resumes", blurb: "Every resume version you've saved, with one marked as your base." },
  { label: "Scan History", href: "/scans", icon: History, section: "scans", blurb: "All your past scans and where each job stands." },
  { label: "Chrome Extension", href: "/extension", icon: Puzzle, section: "extension", blurb: "Scan and save jobs right from the job posting." },
  { label: "Interview Practice", href: "/interview", icon: Mic, section: "interview", blurb: "Practice questions for a job and get feedback on your answers." },
  { label: "Help", href: "/help", icon: LifeBuoy, blurb: "Answers to common questions." },
];

// looks up a nav item by its path
export function navItem(href: string): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item;
}
