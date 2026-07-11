/**
 * Minimal Cloudflare R2 (S3-compatible) PUT helper — same SigV4 style as scripts/upload-r2.mjs.
 * No @aws-sdk dependency.
 */

import { createHash, createHmac } from "crypto";

export class R2ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigError";
  }
}

function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function amzDate(): { amz: string; date: string } {
  const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: `${iso.slice(0, 15)}Z`, date: iso.slice(0, 8) };
}

export function getR2Env(): {
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
} | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKey = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = (process.env.R2_BUCKET_NAME ?? "asfins-textures").trim();
  const publicUrl = (process.env.R2_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (!accountId || !accessKey || !secretKey || !publicUrl) return null;
  return { accountId, accessKey, secretKey, bucket, publicUrl };
}

export function isR2Configured(): boolean {
  return getR2Env() !== null;
}

export function missingR2EnvNames(): string[] {
  return [
    !process.env.R2_ACCOUNT_ID?.trim() && "R2_ACCOUNT_ID",
    !process.env.R2_ACCESS_KEY_ID?.trim() && "R2_ACCESS_KEY_ID",
    !process.env.R2_SECRET_ACCESS_KEY?.trim() && "R2_SECRET_ACCESS_KEY",
    !process.env.R2_PUBLIC_URL?.trim() && "R2_PUBLIC_URL",
  ].filter(Boolean) as string[];
}

export function requireR2Env(): NonNullable<ReturnType<typeof getR2Env>> {
  const env = getR2Env();
  if (!env) {
    const missing = missingR2EnvNames();
    throw new R2ConfigError(
      `Cloudflare R2 is required for scene uploads on Vercel (read-only filesystem). Missing: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables.`
    );
  }
  return env;
}

export function r2PublicUrlForKey(key: string): string {
  const env = requireR2Env();
  const clean = key.replace(/^\/+/, "");
  return `${env.publicUrl}/${clean}`;
}

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

/** Upload a buffer to R2; returns the public HTTPS URL. */
export async function uploadBufferToR2(
  key: string,
  body: Buffer,
  contentType?: string
): Promise<string> {
  const env = requireR2Env();
  const cleanKey = key.replace(/^\/+/, "");
  const ct = contentType ?? contentTypeForKey(cleanKey);
  const endpoint = `https://${env.accountId}.r2.cloudflarestorage.com`;
  const { amz, date } = amzDate();
  const payloadHash = sha256(body);
  const canonicalUri = `/${env.bucket}/${cleanKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const canonicalHeaders = `host:${env.accountId}.r2.cloudflarestorage.com\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${date}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${env.secretKey}`, date);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const auth = `AWS4-HMAC-SHA256 Credential=${env.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${endpoint}/${env.bucket}/${cleanKey}`, {
    method: "PUT",
    headers: {
      Host: `${env.accountId}.r2.cloudflarestorage.com`,
      "Content-Type": ct,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      Authorization: auth,
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`R2 upload failed for ${cleanKey} (${res.status}): ${t.slice(0, 200)}`);
  }

  return `${env.publicUrl}/${cleanKey}`;
}
