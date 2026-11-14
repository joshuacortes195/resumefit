import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile";
import { prefillFromResume } from "./profile-prefill";
import { findAnswerForField, generalize } from "./qa-match";

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
const BLANK = { fullName: null, email: null, phone: null, city: null, state: null, country: null, linkedinUrl: null, githubUrl: null, portfolioUrl: null, yearsExperience: null, school: null, degree: null, major: null, graduationYear: null, workAuthorization: null, needsSponsorship: null, eeoGender: "Decline to self-identify", autoSend: "off" } as unknown as ReturnType<typeof profileSchema.parse>;

describe("starting the application profile from the resume", () => {
  it("fills in contact details, links and school, and leaves the personal answers alone", () => {
    const { profile, filled } = prefillFromResume(BLANK, RESUME);
    expect(profile).toMatchObject({ fullName: "Riley Chen", email: "riley.chen@example.com", phone: "(503) 555-0177", city: "Portland", state: "Oregon", country: "United States", linkedinUrl: "https://linkedin.com/in/rileychen", githubUrl: "https://github.com/rileychen", school: "State University", degree: "Bachelor's degree", graduationYear: "2021" });
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
  it("fits an answer saved for one employer to the same question from another", () => {
    const saved = generalize("Have you ever worked for Figma before, as an employee or a contractor?", "Figma");
    expect(saved).toBe("Have you ever worked for this company before, as an employee or a contractor?");
    const asked = generalize("Have you ever worked for Discord before, as an employee or a contractor?", "Discord");
    expect(findAnswerForField(asked, [{ question: saved, answer: "No" }])?.answer).toBe("No");
    // a name inside another word is left alone, and no name means no change
    expect(generalize("Do you use Figmatic?", "Figma")).toBe("Do you use Figmatic?");
    expect(generalize("Why here?", null)).toBe("Why here?");
  });

  it("needs a short label to be the same question", () => {
    expect(findAnswerForField("how did you hear about us", bank)?.answer).toBe("LinkedIn");
    expect(findAnswerForField("Country", bank)).toBeNull();
    expect(findAnswerForField("Country of Citizenship", bank)?.answer).toBe("United States");
    expect(findAnswerForField("How did you first hear about us at Acme?", bank)?.answer).toBe("LinkedIn");
  });
});
