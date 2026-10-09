import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { isLocalDb, LOCAL_DATA_DIR } from "@/db";
import { serverEnv } from "@/lib/env";

// the secret that saved api keys are locked with, null when there is none to use
export function encryptionSecret(): string | null {
  const fromEnv = serverEnv().ENCRYPTION_KEY;
  if (fromEnv) return fromEnv;
  // on your own machine we make one and keep it next to the local database
  if (!isLocalDb() || LOCAL_DATA_DIR === "memory") return LOCAL_DATA_DIR === "memory" ? "local-test-secret-that-is-long-enough" : null;
  const file = path.join(LOCAL_DATA_DIR, "secret");
  if (!existsSync(file)) {
    mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  return readFileSync(file, "utf8").trim();
}
