// one piece of a word by word comparison
export type DiffPart = { text: string; kind: "same" | "added" | "removed" };

// compares two lines word by word, so a rewrite can show what was added and what was taken out
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);

  // longest run of words the two lines share, worked out from the end backwards
  const shared: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = shared[i];
      if (!row) continue;
      row[j] = a[i] === b[j] ? (shared[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(shared[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const parts: DiffPart[] = [];
  // glues a word onto the piece before it when they are the same kind
  const push = (text: string, kind: DiffPart["kind"]) => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i] ?? "", "same");
      i++;
      j++;
    } else if ((shared[i + 1]?.[j] ?? 0) >= (shared[i]?.[j + 1] ?? 0)) {
      push(a[i] ?? "", "removed");
      i++;
    } else {
      push(b[j] ?? "", "added");
      j++;
    }
  }
  while (i < a.length) push(a[i++] ?? "", "removed");
  while (j < b.length) push(b[j++] ?? "", "added");
  return parts;
}
