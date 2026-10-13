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
  const env = serverEnv();
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
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
    headers: { Authorization: `Bearer ${remote.key}`, apikey: remote.key, "Content-Type": contentType, "x-upsert": "true" },
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
  const response = await fetch(`${remote.url}/storage/v1/object/${BUCKET}/${filePath}`, { headers: { Authorization: `Bearer ${remote.key}`, apikey: remote.key } });
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}

// true when the storage says the file was not there to begin with
async function alreadyGone(response: Response): Promise<boolean> {
  if (response.status === 404) return true;
  // some versions of the storage answer a missing file with a 400 that says not found
  const body = await response.text().catch(() => "");
  return response.status === 400 && /not.?found/i.test(body);
}

// removes a stored file, fine if it was already gone. a delete the storage refuses is an error, so it is never taken for done
export async function deleteFile(filePath: string): Promise<void> {
  const remote = hosted();
  if (!remote) {
    await rm(localPath(filePath), { force: true });
    return;
  }
  const response = await fetch(`${remote.url}/storage/v1/object/${BUCKET}/${filePath}`, { method: "DELETE", headers: { Authorization: `Bearer ${remote.key}`, apikey: remote.key } });
  if (!response.ok && !(await alreadyGone(response))) throw new Error(`Could not remove a stored file (${response.status}).`);
}

// removes every stored file of one person, including any that no resume points at any more
export async function deleteFilesOf(userId: string): Promise<void> {
  const remote = hosted();
  if (!remote) {
    await rm(localPath(userId), { recursive: true, force: true });
    return;
  }
  const headers = { Authorization: `Bearer ${remote.key}`, apikey: remote.key, "Content-Type": "application/json" };
  // the folder is listed and emptied a page at a time until nothing is left in it
  for (let round = 0; round < 50; round++) {
    const listed = await fetch(`${remote.url}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers, body: JSON.stringify({ prefix: userId, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }) });
    if (!listed.ok) throw new Error(`Could not list the stored files (${listed.status}).`);
    const names = ((await listed.json()) as { name: string }[]).map((file) => `${userId}/${file.name}`);
    if (names.length === 0) return;
    const removed = await fetch(`${remote.url}/storage/v1/object/${BUCKET}`, { method: "DELETE", headers, body: JSON.stringify({ prefixes: names }) });
    if (!removed.ok) throw new Error(`Could not remove the stored files (${removed.status}).`);
  }
  throw new Error("Could not remove the stored files, there were too many.");
}
