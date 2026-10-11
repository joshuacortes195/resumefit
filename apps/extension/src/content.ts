import { readJob } from "./lib/job-page";
import { isLinkedinProfile, readLinkedinProfile } from "./lib/linkedin-page";
import type { PageInfo, PageRequest } from "./lib/types";

// this file is put into the page only when the person asks for it. it only reads: the job posting, or a linkedin profile

declare global {
  interface Window {
    __resumefitLoaded?: boolean;
  }
}

// looks the page over: is it a job posting, is it a linkedin profile
function readPage(): PageInfo {
  return { url: location.href, job: readJob(document, location.href), linkedinProfile: isLinkedinProfile(location.href) };
}

if (!window.__resumefitLoaded) {
  window.__resumefitLoaded = true;

  chrome.runtime.onMessage.addListener((request: PageRequest, _sender, respond) => {
    if (request.type === "read-page") {
      respond(readPage());
    } else if (request.type === "read-linkedin") {
      // the profile on screen, read only because the person pressed the import button
      respond(readLinkedinProfile(document, location.href));
    } else if (request.type === "selection") {
      respond(String(getSelection() ?? ""));
    }
    return false;
  });
}
