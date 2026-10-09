import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { paragraphs, structureResume } from "@/lib/export/structure";

// one plain look for exported files: a built in font, one column, text that can be selected
const styles = StyleSheet.create({
  page: { paddingVertical: 54, paddingHorizontal: 54, fontFamily: "Helvetica", fontSize: 11, lineHeight: 1.35, color: "#111111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 14, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 0.75, borderBottomColor: "#999999" },
  line: { marginTop: 3 },
  bulletRow: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 12 },
  bulletText: { flex: 1 },
  paragraph: { marginBottom: 11 },
});

// a single column pdf of a resume
export async function resumePdf(text: string): Promise<Uint8Array> {
  const resume = structureResume(text);
  const buffer = await renderToBuffer(
    <Document title={`${resume.name} resume`} author={resume.name}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.name}</Text>
        {resume.contact.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
        {resume.sections.map((section, sectionIndex) => (
          <View key={sectionIndex}>
            {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
            {section.lines.map((line, lineIndex) =>
              line.bullet ? (
                <View key={lineIndex} style={styles.bulletRow} wrap={false}>
                  <Text style={styles.bulletMark}>•</Text>
                  <Text style={styles.bulletText}>{line.text}</Text>
                </View>
              ) : (
                <Text key={lineIndex} style={styles.line}>
                  {line.text}
                </Text>
              ),
            )}
          </View>
        ))}
      </Page>
    </Document>,
  );
  return new Uint8Array(buffer);
}

// a pdf of a letter
export async function letterPdf(text: string): Promise<Uint8Array> {
  const buffer = await renderToBuffer(
    <Document title="Cover letter">
      <Page size="LETTER" style={{ ...styles.page, paddingVertical: 72, paddingHorizontal: 72 }}>
        {paragraphs(text).map((block, index) => (
          <Text key={index} style={styles.paragraph}>
            {block}
          </Text>
        ))}
      </Page>
    </Document>,
  );
  return new Uint8Array(buffer);
}
