import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// turns the secret from the environment into a key of the right length
function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

// locks a value with aes-gcm, the result holds the nonce, the check tag and the data
export function encrypt(value: string, secret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), nonce);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

// unlocks a value, null when it was tampered with or the secret changed
export function decrypt(sealed: string, secret: string): string | null {
  try {
    const [nonce, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
    if (!nonce || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
