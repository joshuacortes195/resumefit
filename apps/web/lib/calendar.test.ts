import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile } from "./calendar";

const EVENT = { title: "Technical interview, Acme Corp", start: new Date("2026-10-12T15:30:00Z"), details: "Bring questions; ask about on call\nRoom 4", location: "https://meet.example.com/abc" };

describe("calendar helpers", () => {
  it("builds a google calendar link with a one hour slot", () => {
    const url = new URL(googleCalendarUrl(EVENT));
    expect(url.searchParams.get("dates")).toBe("20261012T153000Z/20261012T163000Z");
    expect(url.searchParams.get("text")).toBe(EVENT.title);
    expect(url.searchParams.get("location")).toBe(EVENT.location);
  });

  it("writes a calendar file with escaped text", () => {
    const file = icsFile(EVENT, "abc-123");
    expect(file).toContain("DTSTART:20261012T153000Z");
    expect(file).toContain("DTEND:20261012T163000Z");
    expect(file).toContain("SUMMARY:Technical interview\\, Acme Corp");
    expect(file).toContain("DESCRIPTION:Bring questions\\; ask about on call\\nRoom 4");
    expect(file.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
