import type { QaEntry } from "@/lib/profile";

// words that say nothing about what a question is asking
const FILLER = new Set(["the", "a", "an", "to", "of", "and", "or", "for", "you", "your", "do", "are", "is", "in", "on", "at", "this", "that", "us", "we", "our", "please", "have", "has", "with", "be", "will", "would", "what", "why", "how", "tell", "about", "describe", "here", "there", "at", "as", "it"]);

// the words of a question that carry its meaning
function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !FILLER.has(word)),
  );
}

// how alike two questions are, from 0 to 1: the share of the shorter question's words that the other one also has.
// measured against the shorter one so a company name added to the question does not hide the match
export function similarity(a: string, b: string): number {
  const first = keywords(a);
  const second = keywords(b);
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  for (const word of first) if (second.has(word)) shared += 1;
  // one shared word is never enough to call two questions the same
  if (shared < Math.min(2, first.size, second.size)) return 0;
  return shared / Math.min(first.size, second.size);
}

// the saved answer that fits a question best, when one is close enough
export function findSavedAnswer(question: string, bank: QaEntry[], threshold = 0.65): QaEntry | null {
  let best: QaEntry | null = null;
  let bestScore = threshold;
  for (const entry of bank) {
    const score = similarity(question, entry.question);
    if (score >= bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}
