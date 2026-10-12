import type { LayoutMeta } from "@resumefit/scoring";

// what we get out of an uploaded resume
export type ExtractedFile = {
  text: string;
  layout: LayoutMeta;
};

// a problem with the file that we can explain to the user
export class FileError extends Error {}

// biggest upload we accept. the host turns away any request over 4.5 MB before the app sees it,
// so the limit sits under that and people get our own message
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

// true for colors too pale to read on a white page, takes "#rrggbb", "rrggbb" or "rgb(r,g,b)"
export function isLightColor(color: string): boolean {
  let red: number;
  let green: number;
  let blue: number;
  const hex = color.match(/^#?([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    red = parseInt(hex.slice(0, 2), 16);
    green = parseInt(hex.slice(2, 4), 16);
    blue = parseInt(hex.slice(4, 6), 16);
  } else {
    const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
    if (parts.length < 3) return false;
    [red = 0, green = 0, blue = 0] = parts;
  }
  // how bright the color looks to the eye, 0 is black and 1 is white
  const brightness = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return brightness > 0.72;
}

// the value that shows up most in a list
export function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

// more pages than any resume has. past this we stop reading, so a huge file cannot tie the server up
export const MAX_PDF_PAGES = 15;

// the most a word file may unpack to. a tiny zip can hide gigabytes
export const MAX_UNPACKED_BYTES = 25 * 1024 * 1024;

// a resume saved from word has a few dozen parts inside. thousands means it was built to waste memory
export const MAX_ZIP_ENTRIES = 1000;
