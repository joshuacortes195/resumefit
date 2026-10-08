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
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // one line shown on the page until the feature is built
  blurb: string;
};

// sidebar links, in the order they show up
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, blurb: "Your latest scan, tracker counts and next interview in one place." },
  { label: "AI Optimize", href: "/optimize", icon: Sparkles, blurb: "Get rewrite suggestions and watch your match rate move as you accept them." },
  { label: "AI Cover Letter", href: "/cover-letter", icon: Mail, blurb: "Draft a cover letter from your resume and the job description." },
  { label: "LinkedIn Optimizer", href: "/linkedin", icon: UserSearch, blurb: "Score your LinkedIn profile against the jobs you want." },
  { label: "Auto Apply", href: "/auto-apply", icon: Zap, blurb: "We fill out the application, you review it and hit submit." },
  { label: "Job Tracker", href: "/tracker", icon: Briefcase, blurb: "Drag jobs from Saved to Offer and keep notes on each one." },
  { label: "Find Jobs", href: "/jobs", icon: Search, blurb: "Search open roles and rank them against your resume." },
  { label: "Resume Builder", href: "/builder", icon: PenLine, blurb: "Build a clean resume step by step with templates that parse well." },
  { label: "Resume Manager", href: "/resumes", icon: Files, blurb: "Every resume version you've saved, with one marked as your base." },
  { label: "Scan History", href: "/scans", icon: History, blurb: "All your past scans and where each job stands." },
  { label: "Chrome Extension", href: "/extension", icon: Puzzle, blurb: "Save jobs, scan and autofill right from the job posting." },
  { label: "Interview Practice", href: "/interview", icon: Mic, blurb: "Practice questions for a job and get feedback on your answers." },
  { label: "Help", href: "/help", icon: LifeBuoy, blurb: "Answers to common questions." },
];

// looks up a nav item by its path
export function navItem(href: string): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.href === href);
  if (!item) throw new Error(`No nav item for ${href}`);
  return item;
}
