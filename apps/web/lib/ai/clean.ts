// models like fancy punctuation that some applicant systems cannot read, so every answer is brought back to plain keyboard characters

// swaps the odd characters in one piece of text for their plain versions
export function plainPunctuation(text: string): string {
  return (
    text
      // a dash between two numbers is a range, so it stays a dash. any other long dash becomes a comma
      .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2")
      .replace(/\s*[\u2013\u2014\u2015]\s*/g, ", ")
      // the hyphen look alikes become the one on the keyboard
      .replace(/[\u2010-\u2012\u2212]/g, "-")
      // curly quotes
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[“”„‟]/g, '"')
      // spaces that are not the normal one, and the ones that cannot be seen at all
      .replace(/[  -   ]/g, " ")
      .replace(/[​-‍⁠﻿]/g, "")
      .replace(/…/g, "...")
  );
}

// does the same for every piece of text inside a json answer, however deep it sits
export function plainAnswer<T>(value: T): T {
  if (typeof value === "string") return plainPunctuation(value) as T;
  if (Array.isArray(value)) return value.map((item) => plainAnswer(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainAnswer(item)])) as T;
  return value;
}
