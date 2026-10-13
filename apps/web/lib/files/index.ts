import { readDocx } from "./docx";
import { readPdf } from "./pdf";
import { safeErrorText, withoutNulls } from "@/lib/log";
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

const TOO_LARGE = "That file is over 4 MB. Resumes are usually much smaller, try exporting it again.";

// the bytes of an upload, checked against the size limit before any of it is read into memory
export async function uploadBytes(file: File): Promise<Uint8Array> {
  if (file.size > MAX_FILE_BYTES) throw new FileError(TOO_LARGE);
  return new Uint8Array(await file.arrayBuffer());
}

// reads an uploaded resume, pdf or docx, into text plus layout details
export async function readResumeFile(bytes: Uint8Array, fileName: string | null): Promise<ExtractedFile> {
  if (bytes.byteLength === 0) throw new FileError("That file is empty.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new FileError(TOO_LARGE);

  // the type comes from the file's own bytes. its name and what the browser called it are never trusted
  const type = sniffFileType(bytes);
  if (!type) throw new FileError("We can only read PDF and DOCX files. Old .doc files need to be saved as .docx first.");
  try {
    const read = await (type === "pdf" ? readPdf(bytes, fileName) : readDocx(bytes, fileName));
    // a file can carry a character the database refuses to store
    return { ...read, text: withoutNulls(read.text) };
  } catch (error) {
    if (error instanceof FileError) throw error;
    // a damaged or odd file can trip the readers in ways we did not plan for. the detail goes to the server log, the person gets a plain message
    console.error(`could not read an uploaded ${type}: ${safeErrorText(error, "unknown error")}`);
    throw new FileError("We could not read this file. It may be damaged. Save a fresh copy as PDF or DOCX and upload it again.");
  }
}
