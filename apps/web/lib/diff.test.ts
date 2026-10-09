import { describe, expect, it } from "vitest";
import { vetSuggestions } from "@/lib/ai/optimize";
import type { Suggestion } from "@/lib/ai/prompts/optimize";
import { diffWords } from "./diff";

describe("diffWords", () => {
  it("marks added and removed words and leaves the rest alone", () => {
    const parts = diffWords("Built the checkout flow", "Rebuilt the checkout flow in React");
    expect(parts.filter((part) => part.kind === "removed").map((part) => part.text.trim())).toEqual(["Built"]);
    expect(parts.filter((part) => part.kind === "added").map((part) => part.text.trim()).join(" ")).toBe("Rebuilt in React");
    // putting the kept and added pieces back together gives the new line
    expect(parts.filter((part) => part.kind !== "removed").map((part) => part.text).join("")).toBe("Rebuilt the checkout flow in React");
  });

  it("returns one piece when nothing changed", () => {
    expect(diffWords("same line", "same line")).toEqual([{ text: "same line", kind: "same" }]);
  });
});

describe("vetSuggestions", () => {
  const lines = ["Jordan Lee", "Summary", "Developer who builds web apps.", "• Built the checkout flow in React", "• Helped with testing", "Skills", "React, CSS"];
  const resume = lines.join("\n");
  const base: Suggestion = { id: "x", section: "Experience", target_ref: 3, original: lines[3] ?? "", proposed: "• Rebuilt the checkout flow in React and TypeScript", keywords_added: ["TypeScript"], type: "bullet", requires_user_confirmation: false };

  it("asks for a yes before adding a skill the resume never mentions", () => {
    const [kept] = vetSuggestions([base], lines, resume);
    expect(kept?.requires_user_confirmation).toBe(true);
    // a keyword the resume already has is just a rephrase
    const [rephrase] = vetSuggestions([{ ...base, proposed: "• Rebuilt the checkout flow in React with CSS", keywords_added: ["CSS"] }], lines, resume);
    expect(rephrase?.requires_user_confirmation).toBe(false);
  });

  it("always asks before changing the skills line", () => {
    const [kept] = vetSuggestions([{ ...base, target_ref: 6, original: "React, CSS", proposed: "React, CSS, GraphQL", keywords_added: ["GraphQL"], type: "skills" }], lines, resume);
    expect(kept).toMatchObject({ requires_user_confirmation: true, keywords_added: ["GraphQL"] });
  });

  it("drops changes that point at the wrong line, change nothing or repeat a line", () => {
    const wrongLine = { ...base, target_ref: 4 };
    const outOfRange = { ...base, target_ref: 99 };
    const noChange = { ...base, proposed: lines[3] ?? "" };
    const repeat = { ...base, proposed: "• Something else entirely in React" };
    expect(vetSuggestions([wrongLine, outOfRange, noChange, base, repeat], lines, resume)).toHaveLength(1);
  });

  it("only keeps keywords that made it into the new line, and tidies long dashes", () => {
    const [kept] = vetSuggestions([{ ...base, proposed: "• Rebuilt the checkout flow — now in React", keywords_added: ["TypeScript", "React"] }], lines, resume);
    expect(kept?.keywords_added).toEqual(["React"]);
    expect(kept?.proposed).toBe("• Rebuilt the checkout flow, now in React");
  });
});
