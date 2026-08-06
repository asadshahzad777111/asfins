/**
 * Upload local public/catalog-textures → Cloudflare R2
 * and rewrite catalogs/products URLs to R2 public URL.
 *
 * Setup (one time):
 * 1. Cloudflare → R2 → Create bucket: asfins-textures
 * 2. Settings → Public access → Allow (or custom domain cdn.asfins.com)
 * 3. Manage R2 API Tokens → Create API token (Object Read & Write)
 * 4. Copy Account ID, Access Key ID, Secret Access Key
 * 5. Put in .env.local:
 *    R2_ACCOUNT_ID=...
 *    R2_ACCESS_KEY_ID=...
 *    R2_SECRET_ACCESS_KEY=...
 *    R2_BUCKET_NAME=asfins-textures
 *    R2_PUBLIC_URL=https://pub-xxxx.r2.dev
 *
 * Usage: node scripts/upload-r2.mjs
 */
import { readFile, writeFile, readdir } from "fs/promises";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash, createHmac } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
  return true;
}

const loadedLocal = loadEnvFile(path.join(ROOT, ".env.local"));
const loadedEnv = loadEnvFile(path.join(ROOT, ".env"));
console.log(
  `Env files: .env.local=${loadedLocal ? "ok" : "missing"}, .env=${loadedEnv ? "ok" : "missing"}`
);

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME ?? "asfins-textures";
const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

const missing = [
  !ACCOUNT_ID && "R2_ACCOUNT_ID",
  !ACCESS_KEY && "R2_ACCESS_KEY_ID",
  !SECRET_KEY && "R2_SECRET_ACCESS_KEY",
  !PUBLIC_URL && "R2_PUBLIC_URL",
].filter(Boolean);

if (missing.length) {
  console.error(`Missing R2 env: ${missing.join(", ")}`);
  console.error("Put them in .env.local (never commit) then re-run: npm run upload-r2");
  process.exit(1);
}

const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

/** Offset to apply when local clock is skewed vs real UTC (ms). */
let CLOCK_OFFSET_MS = 0;

async function syncClockOffset() {
  const probes = [
    "https://cloudflare.com",
    "https://www.google.com",
    "https://1.1.1.1",
  ];
  for (const url of probes) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      const dateHdr = res.headers.get("date");
      if (!dateHdr) continue;
      const remote = Date.parse(dateHdr);
      if (!Number.isFinite(remote)) continue;
      CLOCK_OFFSET_MS = remote - Date.now();
      console.log(
        `Clock offset vs ${url}: ${Math.round(CLOCK_OFFSET_MS / 1000)}s`
      );
      return;
    } catch {
      /* try next */
    }
  }
  console.warn("Could not sync clock offset; using local time");
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function amzDate() {
  const d = new Date(Date.now() + CLOCK_OFFSET_MS);
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso.slice(0, 15) + "Z", date: iso.slice(0, 8) };
}

async function putObject(key, body, contentType) {
  const { amz, date } = amzDate();
  const payloadHash = sha256(body);
  const canonicalUri = `/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalHeaders = `host:${ACCOUNT_ID}.r2.cloudflarestorage.com\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amz}\n`;
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

  const kDate = hmac(`AWS4${SECRET_KEY}`, date);
  const kRegion = hmac(kDate, "auto");
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const auth = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${ENDPOINT}/${BUCKET}/${key}`, {
    method: "PUT",
    headers: {
      Host: `${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amz,
      Authorization: auth,
    },
    body,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT ${key} ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function walk(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full, rel)));
    else if (e.name.endsWith(".webp") || e.name.endsWith(".png") || e.name.endsWith(".jpg")) {
      files.push({ rel, full });
    }
  }
  return files;
}

const prefixArg = process.argv.find((a) => a.startsWith("--prefix="));
const PREFIX = prefixArg ? prefixArg.split("=")[1].replace(/^\/+|\/+$/g, "") : "";

await syncClockOffset();

const texRoot = path.join(ROOT, "public/catalog-textures");
let files = await walk(texRoot);
if (PREFIX) {
  files = files.filter((f) => {
    const rel = f.rel.replace(/\\/g, "/");
    return rel === PREFIX || rel.startsWith(`${PREFIX}/`);
  });
}
console.log(
  `Uploading ${files.length} files to R2 bucket ${BUCKET}${PREFIX ? ` (prefix=${PREFIX})` : ""}...\n`
);

let ok = 0;
for (const f of files) {
  const key = `catalog-textures/${f.rel.replace(/\\/g, "/")}`;
  const body = await readFile(f.full);
  const ct = f.rel.endsWith(".webp")
    ? "image/webp"
    : f.rel.endsWith(".png")
      ? "image/png"
      : "image/jpeg";
  try {
    await putObject(key, body, ct);
    ok++;
    if (ok % 20 === 0) console.log(`Uploaded ${ok}/${files.length}`);
  } catch (e) {
    console.error(e.message);
  }
}

console.log(`\nUploaded ${ok}/${files.length}`);

if (PREFIX) {
  console.log(`Skipped JSON rewrite (prefix=${PREFIX}); URLs should already be public.`);
  console.log("Next: npm run seed-mongo");
  process.exit(0);
}

// Rewrite JSON URLs
function rewriteUrl(u) {
  if (!u || typeof u !== "string") return u;
  if (u.startsWith("/catalog-textures/")) {
    return `${PUBLIC_URL}${u}`;
  }
  return u;
}

const catalogsPath = path.join(ROOT, "data/catalogs.json");
const productsPath = path.join(ROOT, "data/products.json");
const catalogs = JSON.parse(await readFile(catalogsPath, "utf8"));
const products = JSON.parse(await readFile(productsPath, "utf8"));

for (const cat of catalogs.catalogs ?? []) {
  for (const sw of cat.swatches ?? []) {
    sw.imageUrl = rewriteUrl(sw.imageUrl);
    sw.thumbUrl = rewriteUrl(sw.thumbUrl);
  }
}
for (const p of products.products ?? []) {
  p.image = rewriteUrl(p.image);
}

await writeFile(catalogsPath, JSON.stringify(catalogs, null, 2) + "\n");
await writeFile(productsPath, JSON.stringify(products, null, 2) + "\n");

console.log(`URLs rewritten to ${PUBLIC_URL}`);
console.log("Next: git add + commit + push → Vercel redeploy");
