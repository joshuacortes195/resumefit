"use client";

import { useEffect, useRef, useState } from "react";

// what one of our own pdf addresses turned out to be: the original upload, a builder template, or a plain page made from the text
export type PdfSource = "original" | "builder" | "text";

// the pdf reader is big, so it is only fetched the first time a pdf is actually drawn
let reader: Promise<typeof import("unpdf")> | null = null;
const loadReader = () => (reader ??= import("unpdf"));

// pdfs already fetched, so a thumbnail and the full view of the same resume share one download
const fetched = new Map<string, Promise<{ bytes: Uint8Array; source: PdfSource } | null>>();
function fetchPdf(url: string) {
  let wait = fetched.get(url);
  if (!wait) {
    wait = fetch(url)
      .then(async (response) => (response.ok ? { bytes: new Uint8Array(await response.arrayBuffer()), source: (response.headers.get("X-Resume-Preview") as PdfSource | null) ?? "text" } : null))
      .catch(() => null);
    fetched.set(url, wait);
    // not kept for long, a resume can be edited and its pdf with it
    setTimeout(() => fetched.delete(url), 60_000);
  }
  return wait;
}

type PdfPagesProps = {
  url: string;
  // how many pages to draw, the first one only for a thumbnail
  pages?: number;
  // words for a screen reader, since a drawing has none
  label: string;
  onSource?: (source: PdfSource) => void;
  className?: string;
};

// draws a pdf the way it looks when opened, page by page, on plain canvases. no viewer, no plugin, so it works on a phone too
export function PdfPages({ url, pages = 20, label, onSource, className = "" }: PdfPagesProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"waiting" | "drawing" | "done" | "failed">("waiting");
  const [seen, setSeen] = useState(false);

  // nothing is fetched until the box is near the screen, so a long list does not draw every resume at once
  useEffect(() => {
    const box = holder.current;
    if (!box) return;
    const watcher = new IntersectionObserver(([entry]) => entry?.isIntersecting && setSeen(true), { rootMargin: "200px" });
    watcher.observe(box);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => {
    const box = holder.current;
    if (!seen || !box) return;
    let current = true;
    void (async () => {
      setState("drawing");
      try {
        const [file, { getDocumentProxy }] = await Promise.all([fetchPdf(url), loadReader()]);
        if (!file) throw new Error("no pdf");
        if (!current) return;
        onSource?.(file.source);
        // the reader keeps the bytes it is given, so each drawing gets its own copy
        const pdf = await getDocumentProxy(file.bytes.slice());
        const count = Math.min(pdf.numPages, pages);
        const drawn: HTMLCanvasElement[] = [];
        for (let number = 1; number <= count; number++) {
          const page = await pdf.getPage(number);
          // drawn at twice the box's width so it stays sharp on a dense screen, never wider than a full page needs
          const natural = page.getViewport({ scale: 1 });
          // a small thumbnail is still drawn a few hundred dots wide and shrunk by the browser, which keeps its lines of text readable
          const scale = Math.min(2.5, Math.max(box.clientWidth * Math.min(window.devicePixelRatio || 1, 2), 360) / natural.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "block h-auto w-full bg-white";
          const context = canvas.getContext("2d");
          if (!context) throw new Error("no canvas");
          await page.render({ canvasContext: context, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
          drawn.push(canvas);
        }
        if (!current) return;
        box.replaceChildren(...drawn);
        setState("done");
      } catch {
        if (current) setState("failed");
      }
    })();
    return () => {
      current = false;
    };
    // the callback is only a messenger, a new one must not redraw the pdf
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, url, pages]);

  return (
    <div className={className}>
      {/* the pages themselves. the box keeps a page's shape while it waits, so nothing jumps when the drawing lands */}
      <div ref={holder} role="img" aria-label={label} className={`space-y-2 ${state === "done" ? "" : `aspect-[8.5/11] rounded-sm bg-border/60 ${state === "failed" ? "" : "animate-pulse"}`}`} />
      {state === "failed" && <p className="mt-1 text-xs text-muted">Could not draw this one.</p>}
    </div>
  );
}
