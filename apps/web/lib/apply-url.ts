import { BOARDS } from "@/lib/job-boards";

// turns the address of a job posting into the address of its application form, on the job sites where we know how.
// anything we do not recognize comes back unchanged
export function applyUrl(posting: string): string {
  if (!URL.canParse(posting)) return posting;
  const url = new URL(posting);
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // lever: the form is the posting's address with /apply on the end
  if (host === "jobs.lever.co" && parts.length === 2) return `${url.origin}/${parts.join("/")}/apply`;

  // ashby: the same idea, with /application
  if (host === "jobs.ashbyhq.com" && parts.length === 2) return `${url.origin}/${parts.join("/")}/application`;

  // greenhouse postings often live on the company's own site. the form itself is always at greenhouse, under the company's board name
  const jobId = url.searchParams.get("gh_jid");
  if (jobId && /^\d+$/.test(jobId) && !host.endsWith("greenhouse.io")) {
    const board = BOARDS.find((entry) => entry.source === "greenhouse" && (host === entry.domain || host.endsWith(`.${entry.domain}`)));
    if (board) return `https://boards.greenhouse.io/embed/job_app?for=${board.token}&token=${jobId}`;
  }
  return posting;
}
