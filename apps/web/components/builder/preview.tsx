import type { CSSProperties } from "react";
import type { LaidOut } from "@/lib/builder/layout";
import { getTemplate } from "@/lib/builder/templates";
import { ACCENTS, type TemplateSettings } from "@/lib/builder/types";

// the live picture of the resume, drawn like a sheet of letter paper that shrinks to fit its column
export function ResumePreview({ laid, settings }: { laid: LaidOut; settings: TemplateSettings }) {
  const template = getTemplate(settings.template);
  const accent = ACCENTS[settings.accent];
  const centered = template.header === "center";
  // every size inside is in em, so the whole page scales with the width of its box
  const page: CSSProperties = {
    containerType: "inline-size",
    fontFamily: template.font === "serif" ? 'Georgia, "Times New Roman", serif' : "Arial, Helvetica, sans-serif",
  };
  const sheet: CSSProperties = { fontSize: "1.72cqw", lineHeight: settings.lineSpacing + 0.2, padding: `${(settings.margins / 8.5) * 100}cqw` };

  // section headings look different in each template
  const headingStyle: CSSProperties =
    template.heading === "rule"
      ? { borderBottom: `1px solid ${accent}`, paddingBottom: "0.15em" }
      : template.heading === "caps"
        ? { textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.95em" }
        : template.heading === "bar"
          ? { borderLeft: `0.3em solid ${accent}`, paddingLeft: "0.5em" }
          : {};

  const empty = !laid.name && laid.sections.length === 0;

  return (
    <div style={page} className="w-full" aria-label="Resume preview">
      {/* always white paper with dark ink, whatever theme the app is in */}
      <div style={sheet} className="aspect-[8.5/11] min-h-fit w-full overflow-hidden rounded-sm bg-white text-[#111111] shadow-lg ring-1 ring-black/10">
        {empty ? (
          <p style={{ color: "#777777" }}>Your resume will show up here as you fill in each step.</p>
        ) : (
          <>
            <header style={{ textAlign: centered ? "center" : "left" }}>
              <p style={{ fontSize: "1.9em", fontWeight: 700, lineHeight: 1.15, color: accent }}>{laid.name || "Your Name"}</p>
              {laid.headline && <p style={{ fontSize: "1.1em", marginTop: "0.15em" }}>{laid.headline}</p>}
              {laid.contact.length > 0 && <p style={{ marginTop: "0.25em", fontSize: "0.95em" }}>{laid.contact.join("  |  ")}</p>}
            </header>

            {laid.sections.map((section) => (
              <section key={section.key} style={{ marginTop: "1.1em" }}>
                <p style={{ fontWeight: 700, fontSize: "1.08em", color: accent, marginBottom: "0.35em", ...headingStyle }}>{section.title}</p>
                {section.blocks.map((block, index) => {
                  if (block.kind === "text") return <p key={index}>{block.text}</p>;
                  if (block.kind === "skills") {
                    // a few columns of words, or one flowing line
                    return template.skills === "grid" ? (
                      <ul key={index} style={{ columns: 3, columnGap: "1.5em" }}>
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={index}>{block.items.join(", ")}</p>
                    );
                  }
                  if (block.kind === "list") {
                    return (
                      <ul key={index} style={{ paddingLeft: "1.2em", listStyle: "disc" }}>
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <div key={index} style={{ marginTop: index === 0 ? 0 : "0.7em" }}>
                      <p style={{ display: "flex", justifyContent: "space-between", gap: "1em" }}>
                        <span style={{ fontWeight: 700 }}>{block.title}</span>
                        <span style={{ whiteSpace: "nowrap" }}>{block.right}</span>
                      </p>
                      {block.subtitle && <p style={{ fontStyle: "italic" }}>{block.subtitle}</p>}
                      {block.bullets.length > 0 && (
                        <ul style={{ paddingLeft: "1.2em", listStyle: "disc", marginTop: "0.15em" }}>
                          {block.bullets.map((bullet, bulletIndex) => (
                            <li key={bulletIndex}>{bullet}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
