import crypto from "crypto";

const ALG = "aes-256-gcm";

function resolveKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Buf = Buffer.from(raw, "base64");
  if (base64Buf.length === 32) {
    return base64Buf;
  }

  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts sensitive KYC/bank values with AES-256-GCM when DATA_ENCRYPTION_KEY is configured.
 * Output format: `enc:v1:<iv_b64>:<tag_b64>:<cipher_b64>`
 */
export function encryptSensitiveField(plaintext: string | null | undefined): string | null {
  if (!plaintext || !plaintext.trim()) return null;
  const trimmed = plaintext.trim();
  if (trimmed.startsWith("enc:v1:")) return trimmed;

  const key = resolveKey();
  if (!key) {
    return trimmed;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `enc:v1:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypts AES-256-GCM encrypted fields; returns plaintext or raw fallback if unencrypted.
 */
export function decryptSensitiveField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("enc:v1:")) return value;

  const key = resolveKey();
  if (!key) return "[ENCRYPTED]";

  const parts = value.split(":");
  if (parts.length !== 5) return "[INVALID_CIPHER]";

  try {
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const data = Buffer.from(parts[4], "base64");
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "[DECRYPT_ERROR]";
  }
}

/**
 * Masks sensitive account/tax identifiers so only the last 4 characters appear in non-privileged UIs.
 */
export function maskSensitiveValue(value: string | null | undefined): string {
  const plain = value?.startsWith("enc:v1:")
    ? decryptSensitiveField(value)
    : value;
  if (!plain || plain.startsWith("[")) return "••••";
  const clean = plain.trim();
  if (clean.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export function maskBankAccount(accountNo: string | null | undefined): string {
  return maskSensitiveValue(accountNo);
}

export function maskTaxId(idValue: string | null | undefined): string {
  return maskSensitiveValue(idValue);
}

