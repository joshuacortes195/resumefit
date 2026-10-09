import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LOCAL_DATA_DIR } from "@/db";
import { publicEnv, serverEnv } from "@/lib/env";

// the private bucket uploads go into on the hosted setup
const BUCKET = "resumes";

// true when the hosted file storage has its keys
function hosted(): { url: string; key: string } | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

// where a file sits on disk when running locally
function localPath(filePath: string): string {
  // file paths are built from ids we made ourselves, this just makes sure none can climb out of the folder
  const safe = filePath.split("/").filter((part) => part && part !== "..").join("/");
  // tests keep their database in memory, so their uploads go to the system temp folder
  const base = LOCAL_DATA_DIR === "memory" ? path.join(tmpdir(), "resumefit-test") : LOCAL_DATA_DIR;
  return path.join(base, "uploads", safe);
}

// saves an uploaded file, the path is "userId/resumeId.ext"
export async function saveFile(filePath: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const remote = hosted();
  if (!remote) {
    await mkdir(path.dirname(localPath(filePath)), { recursive: true });
    await writeFile(localPath(filePath), bytes);
    return;
  }
  const response = await fetch(`${remote.url}/storage/v1/object/${BUCKET}/${filePath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${remote.key}`, "Content-Type": contentType, "x-upsert": "true" },
    body: Buffer.from(bytes),
  });
  if (!response.ok) throw new Error(`Could not store the file (${response.status}).`);
}

// reads a stored file back, null when it is gone
export async function loadFile(filePath: string): Promise<Uint8Array | null> {
  const remote = hosted();
  if (!remote) {
    return readFile(localPath(filePath)).then(
      (buffer) => new Uint8Array(buffer),
      () => null,
    );
  }
  const response = await fetch(`${remote.url}/storage/v1/object/${BUCKET}/${filePath}`, { headers: { Authorization: `Bearer ${remote.key}` } });
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}

// removes a stored file, fine if it was already gone
export async function deleteFile(filePath: string): Promise<void> {
  const remote = hosted();
  if (!remote) {
    await rm(localPath(filePath), { force: true });
    return;
  }
  await fetch(`${remote.url}/storage/v1/object/${BUCKET}/${filePath}`, { method: "DELETE", headers: { Authorization: `Bearer ${remote.key}` } });
}
