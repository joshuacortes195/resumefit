// job sites whose own rules forbid filling in their application forms with a tool. auto apply never runs on them
const NO_AUTOMATION = [/(^|\.)linkedin\.com$/, /(^|\.)indeed\.com$/];

// true on a site where auto apply stays switched off. scanning and saving the posting still work there
export function fillBlocked(hostname: string): boolean {
  return NO_AUTOMATION.some((host) => host.test(hostname));
}
