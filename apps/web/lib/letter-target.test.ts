import { describe, expect, it } from "vitest";
import { parseTarget } from "@/lib/letter-target";

describe("who a cover letter is for", () => {
  it("splits the job from the company", () => {
    expect(parseTarget("Software Engineer Intern for Google")).toEqual({ jobTitle: "Software Engineer Intern", company: "Google" });
    expect(parseTarget("Nurse Manager at  Mesa Health")).toEqual({ jobTitle: "Nurse Manager", company: "Mesa Health" });
    expect(parseTarget("Buyer @ Harbor Freight")).toEqual({ jobTitle: "Buyer", company: "Harbor Freight" });
    expect(parseTarget("Supply Chain Analyst, Northwind")).toEqual({ jobTitle: "Supply Chain Analyst", company: "Northwind" });
    expect(parseTarget("Manager for Operations at Acme")).toEqual({ jobTitle: "Manager for Operations", company: "Acme" });
  });

  it("keeps a bare job title whole", () => {
    expect(parseTarget("Data Analyst")).toEqual({ jobTitle: "Data Analyst", company: "" });
    expect(parseTarget("  ")).toEqual({ jobTitle: "", company: "" });
  });
});
