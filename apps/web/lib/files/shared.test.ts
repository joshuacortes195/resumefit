import { describe, expect, it } from "vitest";
import { splitLabelledLists } from "./shared";

describe("skills rows a pdf ran together", () => {
  it("puts each labelled row back on its own line", () => {
    const joined = "Cloud and Tools: AWS S3, Docker, Git, Supabase Concepts: Data Structures and Algorithms, REST APIs, Testing";
    expect(splitLabelledLists(joined)).toBe("Cloud and Tools: AWS S3, Docker, Git, Supabase\nConcepts: Data Structures and Algorithms, REST APIs, Testing");
    expect(splitLabelledLists("Languages: Python, Java Frameworks & Libraries: React, Flask Tools: Git")).toBe("Languages: Python, Java\nFrameworks & Libraries: React, Flask\nTools: Git");
  });

  it("leaves rows that are already apart, and ordinary sentences, alone", () => {
    const fine = "Languages: Python, TypeScript, SQL\nFrameworks: React, Next.js\n• Built tools for the data team. Tools: none listed";
    expect(splitLabelledLists(fine)).toBe(fine);
    expect(splitLabelledLists("Concepts: Machine Learning (ML), Computer Vision (CV)")).toBe("Concepts: Machine Learning (ML), Computer Vision (CV)");
  });
});
