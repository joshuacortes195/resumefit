// helpers for putting an interview on a calendar

export type CalendarEvent = {
  title: string;
  start: Date;
  // how long the event runs, in minutes
  minutes?: number;
  details?: string;
  location?: string;
};

// calendar files want times like 20261008T153000Z
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// when the event ends, an hour after it starts unless told otherwise
function endOf(event: CalendarEvent): Date {
  return new Date(event.start.getTime() + (event.minutes ?? 60) * 60_000);
}

// a link that opens google calendar with the event filled in
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates: `${stamp(event.start)}/${stamp(endOf(event))}` });
  if (event.details) params.set("details", event.details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

// commas, semicolons and new lines have to be escaped inside a calendar file
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/[,;]/g, "\\$&").replace(/\r?\n/g, "\\n");
}

// the text of an .ics file that any calendar app can open
export function icsFile(event: CalendarEvent, uid: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ResumeFit//Job Tracker//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@resumefit`,
    `DTSTAMP:${stamp(event.start)}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(endOf(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.details ? [`DESCRIPTION:${escapeText(event.details)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
