import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// 服务端加密用户自定义大模型 API Key。
// 生产环境请设置 LLM_CONFIG_ENCRYPTION_KEY（任意足够长的字符串即可，用于派生 32 字节密钥）；
// 未设置时回退到 SUPABASE_SERVICE_ROLE_KEY，再回退到开发占位符（仅本地开发，勿用于生产）。

function getKey(): Buffer {
  const raw =
    process.env.LLM_CONFIG_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "product-drill-dev-secret-key-please-set-LLM_CONFIG_ENCRYPTION_KEY";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(secret: string): string {
  if (secret.length <= 6) return "****";
  return `${secret.slice(0, 3)}****${secret.slice(-4)}`;
}