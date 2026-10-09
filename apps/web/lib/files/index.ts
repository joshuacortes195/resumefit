import { readDocx } from "./docx";
import { readPdf } from "./pdf";
import { FileError, MAX_FILE_BYTES, type ExtractedFile } from "./shared";

export { FileError, MAX_FILE_BYTES, type ExtractedFile } from "./shared";

// works out the real file type from its first bytes, not from its name
export function sniffFileType(bytes: Uint8Array): "pdf" | "docx" | null {
  const start = String.fromCharCode(...bytes.slice(0, 5));
  if (start === "%PDF-") return "pdf";
  // docx files are zip archives, which start with PK
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "docx";
  return null;
}

// reads an uploaded resume, pdf or docx, into text plus layout details
export async function readResumeFile(bytes: Uint8Array, fileName: string | null): Promise<ExtractedFile> {
  if (bytes.byteLength === 0) throw new FileError("That file is empty.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new FileError("That file is over 5 MB. Resumes are usually much smaller, try exporting it again.");

  const type = sniffFileType(bytes);
  if (type === "pdf") return readPdf(bytes, fileName);
  if (type === "docx") return readDocx(bytes, fileName);
  throw new FileError("We can only read PDF and DOCX files. Old .doc files need to be saved as .docx first.");
}
