import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile";
import { prefillFromResume } from "./profile-prefill";
import { findAnswerForField } from "./qa-match";

const RESUME = `Riley Chen
Portland, OR | riley.chen@example.com | (503) 555-0177 | linkedin.com/in/rileychen | github.com/rileychen

Summary
Frontend engineer who builds fast, accessible web apps.

Work Experience
Frontend Engineer, Lakeside Outfitters
Mar 2022 - Present
• Rebuilt the checkout in React and TypeScript, cutting drop off by 18%

Education
B.S. Computer Science, State University, 2021
`;

// a profile exactly as a new person has it
const BLANK = { fullName: null, email: null, phone: null, city: null, state: null, linkedinUrl: null, githubUrl: null, portfolioUrl: null, yearsExperience: null, school: null, degree: null, major: null, graduationYear: null, workAuthorization: null, needsSponsorship: null, eeoGender: "Decline to self-identify", autoSend: "off" } as unknown as ReturnType<typeof profileSchema.parse>;

describe("starting the application profile from the resume", () => {
  it("fills in contact details, links and school, and leaves the personal answers alone", () => {
    const { profile, filled } = prefillFromResume(BLANK, RESUME);
    expect(profile).toMatchObject({ fullName: "Riley Chen", email: "riley.chen@example.com", phone: "(503) 555-0177", city: "Portland", state: "OR", linkedinUrl: "https://linkedin.com/in/rileychen", githubUrl: "https://github.com/rileychen", school: "State University", degree: "Bachelor's degree", graduationYear: "2021" });
    expect(filled).toBeGreaterThanOrEqual(9);
    // never guessed
    expect([profile.workAuthorization, profile.needsSponsorship, profile.eeoGender, profile.autoSend]).toEqual([null, null, "Decline to self-identify", "off"]);
  });

  it("never writes over an answer the person already gave", () => {
    const { profile } = prefillFromResume({ ...BLANK, fullName: "Riley J. Chen", city: "Seattle" }, RESUME);
    expect([profile.fullName, profile.city, profile.email]).toEqual(["Riley J. Chen", "Seattle", "riley.chen@example.com"]);
  });
});

describe("finding a saved answer for a form field", () => {
  const bank = [
    { question: "How did you hear about us?", answer: "LinkedIn" },
    { question: "Country of citizenship", answer: "United States" },
  ];
  it("needs a short label to be the same question", () => {
    expect(findAnswerForField("how did you hear about us", bank)?.answer).toBe("LinkedIn");
    expect(findAnswerForField("Country", bank)).toBeNull();
    expect(findAnswerForField("Country of Citizenship", bank)?.answer).toBe("United States");
    expect(findAnswerForField("How did you first hear about us at Acme?", bank)?.answer).toBe("LinkedIn");
  });
});
