import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { layOut } from "@/lib/builder/layout";
import { getTemplate } from "@/lib/builder/templates";
import { ACCENTS, type BuilderData, type TemplateSettings } from "@/lib/builder/types";

// builds the pdf of a resume from the builder, one column, real text, built in fonts
export async function builderPdf(data: BuilderData, settings: TemplateSettings): Promise<Uint8Array> {
  const laid = layOut(data, settings.template);
  const template = getTemplate(settings.template);
  const accent = ACCENTS[settings.accent];
  const regular = template.font === "serif" ? "Times-Roman" : "Helvetica";
  const bold = template.font === "serif" ? "Times-Bold" : "Helvetica-Bold";
  const italic = template.font === "serif" ? "Times-Italic" : "Helvetica-Oblique";
  const size = template.font === "serif" ? 11 : 10.5;
  const centered = template.header === "center";
  const margin = settings.margins * 72;

  // section headings look different in each template
  const heading =
    template.heading === "rule"
      ? { borderBottomWidth: 0.75, borderBottomColor: accent, paddingBottom: 2 }
      : template.heading === "caps"
        ? { textTransform: "uppercase" as const, letterSpacing: 0.8, fontSize: size }
        : template.heading === "bar"
          ? { borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: 6 }
          : {};

  // one bullet line, with the mark hanging to the left of the text
  const bullet = (text: string, key: number) => (
    <View key={key} style={{ flexDirection: "row", marginTop: 1.5 }}>
      <Text style={{ width: 11 }}>•</Text>
      <Text style={{ flex: 1 }}>{text}</Text>
    </View>
  );

  const buffer = await renderToBuffer(
    <Document title={`${laid.name} resume`} author={laid.name}>
      <Page size="LETTER" style={{ padding: margin, fontFamily: regular, fontSize: size, lineHeight: settings.lineSpacing + 0.15, color: "#111111" }}>
        <View style={{ alignItems: centered ? "center" : "flex-start" }}>
          <Text style={{ fontFamily: bold, fontSize: 20, lineHeight: 1.2, color: accent }}>{laid.name}</Text>
          {laid.headline ? <Text style={{ fontSize: size + 1 }}>{laid.headline}</Text> : null}
          {laid.contact.length > 0 ? <Text style={{ marginTop: 2 }}>{laid.contact.join("  |  ")}</Text> : null}
        </View>

        {laid.sections.map((section) => (
          <View key={section.key} style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: bold, fontSize: size + 1, color: accent, marginBottom: 4, ...heading }}>{section.title}</Text>
            {section.blocks.map((block, index) => {
              if (block.kind === "text") return <Text key={index}>{block.text}</Text>;
              if (block.kind === "skills") return <Text key={index}>{block.items.join(", ")}</Text>;
              if (block.kind === "list") return <View key={index}>{block.items.map(bullet)}</View>;
              return (
                <View key={index} style={{ marginTop: index === 0 ? 0 : 7 }} wrap={false}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: bold, flex: 1 }}>{block.title}</Text>
                    <Text>{block.right}</Text>
                  </View>
                  {block.subtitle ? <Text style={{ fontFamily: italic }}>{block.subtitle}</Text> : null}
                  {block.bullets.map(bullet)}
                </View>
              );
            })}
          </View>
        ))}
      </Page>
    </Document>,
  );
  return new Uint8Array(buffer);
}
