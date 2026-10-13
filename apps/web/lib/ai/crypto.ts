import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// turns the secret from the environment into a key of the right length
function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

// the sizes of the nonce and of the tag that proves nothing was changed. anything else is refused,
// since a shortened tag is far easier to forge
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

// locks a value with aes-gcm, the result holds the nonce, the check tag and the data
export function encrypt(value: string, secret: string): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), nonce, { authTagLength: TAG_BYTES });
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

// unlocks a value, null when it was tampered with or the secret changed
export function decrypt(sealed: string, secret: string): string | null {
  try {
    const [nonce, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
    if (!nonce || !tag || !data || nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), nonce, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
