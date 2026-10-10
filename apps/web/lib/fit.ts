// the words shown next to a fit score. kept apart from the job feed so the browser can use it without the rest
export function fitLabel(fit: number | null): "Great fit" | "Good fit" | "Possible fit" | null {
  if (fit === null) return null;
  return fit >= 70 ? "Great fit" : fit >= 50 ? "Good fit" : fit >= 30 ? "Possible fit" : null;
}
