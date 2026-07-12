/**
 * One-shot: process bathroom-cabinet cutouts → R2 + Mongo (production gallery).
 * Mirrors admin simple-mode (wizardMode=simple) + mask-alpha TRANSPARENT_MAJORITY=0.55.
 *
 * Usage: node scripts/upload-bathroom-cabinet-scene.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createHash, createHmac } from "crypto";
import dns from "dns";
import sharp from "sharp";
import { MongoClient } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CUT = path.join(ROOT, "public/scenes/_exports/bathroom-cabinet-cut");
const SCENE_ID = "bathroom-cabinet";
const WORK = path.join(ROOT, "tmp-test-assets", SCENE_ID);

const ALPHA_CUTOFF = 128;
const TRANSPARENT_MAJORITY = 0.55;

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

loadEnvFile(path.join(ROOT, ".env.local"));

function detectAlphaPolarity(data, pixelCount) {
  const total = pixelCount ?? data.length / 4;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < ALPHA_CUTOFF) transparent++;
  }
  return transparent / total > TRANSPARENT_MAJORITY
    ? "opaque-zone"
    : "transparent-zone";
}

function isMaskPixelInside(a, polarity) {
  if (polarity === "opaque-zone") return a >= ALPHA_CUTOFF;
  return a < ALPHA_CUTOFF;
}

function layerHasAlphaVariation(data, pixelCount) {
  const total = pixelCount ?? data.length / 4;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) transparent++;
  }
  return transparent / total > 0.02;
}

function erode(binary, W, H, radius = 1) {
  const out = new Uint8Array(binary.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!binary[i]) continue;
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        for (let dx = -radius; dx <= radius && keep; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
            keep = false;
            break;
          }
          if (!binary[ny * W + nx]) keep = false;
        }
      }
      if (keep) out[i] = 1;
    }
  }
  return out;
}

function dilate(binary, W, H, radius = 1) {
  const out = new Uint8Array(binary.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (binary[i]) {
        out[i] = 1;
        continue;
      }
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (binary[ny * W + nx]) {
            out[i] = 1;
            break;
          }
        }
        if (out[i]) break;
      }
    }
  }
  return out;
}

function morphOpen(binary, W, H, radius = 1) {
  return dilate(erode(binary, W, H, radius), W, H, radius);
}
function morphClose(binary, W, H, radius = 1) {
  return erode(dilate(binary, W, H, radius), W, H, radius);
}

async function buildMaskFromLayer(layerPath, outPath, W, H) {
  const layerRaw = await sharp(layerPath)
    .resize(W, H, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const polarity = detectAlphaPolarity(layerRaw, W * H);
  const useAlpha = layerHasAlphaVariation(layerRaw, W * H);
  if (!useAlpha) throw new Error(`${path.basename(layerPath)} has no alpha variation`);

  const binary = new Uint8Array(W * H);
  let inside = 0;
  for (let i = 0; i < W * H; i++) {
    binary[i] = isMaskPixelInside(layerRaw[i * 4 + 3], polarity) ? 1 : 0;
    if (binary[i]) inside++;
  }
  const cleaned = morphClose(morphOpen(binary, W, H, 1), W, H, 1);
  const mask = Buffer.alloc(W * H * 4);
  let active = 0;
  for (let i = 0; i < W * H; i++) {
    const mi = i * 4;
    if (!cleaned[i]) {
      mask[mi] = mask[mi + 1] = mask[mi + 2] = mask[mi + 3] = 0;
    } else {
      mask[mi] = mask[mi + 1] = mask[mi + 2] = mask[mi + 3] = 255;
      active++;
    }
  }
  await sharp(mask, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outPath);
  return {
    polarity,
    activePercent: Math.round((active / (W * H)) * 10000) / 100,
    transparentPercent: Math.round((inside / (W * H)) * 10000) / 100,
  };
}

async function createOverlays(dir, W, H) {
  const highlight = Buffer.from(
    `<svg width="${W}" height="${H}"><ellipse cx="${W * 0.45}" cy="${H * 0.28}" rx="${W * 0.22}" ry="${H * 0.1}" fill="white" opacity="0.18"/></svg>`
  );
  await sharp(highlight).png().toFile(path.join(dir, "highlight-gloss.png"));
  const glow = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="g"><stop offset="0%" stop-color="#ffb870" stop-opacity="0.45"/><stop offset="100%" stop-color="#ffb870" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(glow).png().toFile(path.join(dir, "night-glow.png"));
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}
function amzDate() {
  const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz: iso.slice(0, 15) + "Z", date: iso.slice(0, 8) };
}

async function putObject(key, body, contentType) {
  const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
  const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const BUCKET = process.env.R2_BUCKET_NAME ?? "asfins-textures";
  const ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

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
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");
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

function contentType(file) {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function walkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_PUBLIC_URL",
    "MONGODB_URI",
  ];
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("Missing env:", missing.join(", "));
    process.exit(1);
  }

  for (const f of ["base.jpg", "cutout-cabinets.png", "cutout-wall.png"]) {
    if (!existsSync(path.join(CUT, f))) {
      console.error("Missing", f);
      process.exit(1);
    }
  }

  mkdirSync(WORK, { recursive: true });

  const baseSrc = path.join(CUT, "base.jpg");
  const meta = await sharp(baseSrc).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log(`Base ${W}x${H}`);

  await sharp(baseSrc).jpeg({ quality: 88 }).toFile(path.join(WORK, "base.jpg"));
  await sharp(baseSrc)
    .resize(400, 300, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toFile(path.join(WORK, "thumb.jpg"));

  await copyFile(
    path.join(CUT, "cutout-cabinets.png"),
    path.join(WORK, "layer-cabinets.png")
  );
  await copyFile(path.join(CUT, "cutout-wall.png"), path.join(WORK, "layer-wall.png"));

  const cab = await buildMaskFromLayer(
    path.join(WORK, "layer-cabinets.png"),
    path.join(WORK, "mask-cabinets.png"),
    W,
    H
  );
  const wall = await buildMaskFromLayer(
    path.join(WORK, "layer-wall.png"),
    path.join(WORK, "mask-wall.png"),
    W,
    H
  );
  console.log("cabinets mask:", cab);
  console.log("wall mask:", wall);

  await createOverlays(WORK, W, H);

  // Simple merged cutout for advanced re-edit familiarity
  await copyFile(
    path.join(WORK, "layer-cabinets.png"),
    path.join(WORK, "master-cutout.png")
  );

  const PUBLIC_URL = process.env.R2_PUBLIC_URL.replace(/\/$/, "");
  const assetBase = `${PUBLIC_URL}/scenes/${SCENE_ID}`;

  const files = walkFiles(WORK);
  console.log(`Uploading ${files.length} files to R2…`);
  for (const full of files) {
    const rel = path.relative(WORK, full).replace(/\\/g, "/");
    const key = `scenes/${SCENE_ID}/${rel}`;
    const body = await readFile(full);
    await putObject(key, body, contentType(rel));
    console.log("  OK", key, body.length);
  }

  const record = {
    id: SCENE_ID,
    name: "Bathroom Cabinet",
    description: "Floating bathroom cabinet — cabinets & wall colour",
    category: "bathroom",
    width: W,
    height: H,
    thumbnail: `${assetBase}/thumb.jpg`,
    basePhoto: `${assetBase}/base.jpg`,
    highlightMap: `${assetBase}/highlight-gloss.png`,
    nightGlow: `${assetBase}/night-glow.png`,
    zones: [
      {
        id: "cabinets",
        label: "Cabinets",
        palette: "wood",
        zoneGroup: "wood",
        zIndex: 12,
        glossyHighlight: true,
        maskPath: `${assetBase}/mask-cabinets.png`,
      },
      {
        id: "wall",
        label: "Wall",
        palette: "paint",
        zoneGroup: "surface",
        zIndex: 2,
        glossyHighlight: false,
        maskPath: `${assetBase}/mask-wall.png`,
      },
    ],
    catalogIds: ["artisan-laminates", "greenply", "local-paint", "zrk-group"],
    createdAt: new Date().toISOString(),
    published: true,
  };

  const DB_NAME = process.env.MONGODB_DB_NAME ?? "asfins";
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const col = client.db(DB_NAME).collection("scenes");
  await col.updateOne(
    { id: SCENE_ID },
    { $set: { ...record }, $setOnInsert: { _id: SCENE_ID } },
    { upsert: true }
  );
  await client.close();
  console.log(`Mongo upserted scene "${SCENE_ID}" in ${DB_NAME}`);

  writeFileSync(
    path.join(WORK, "scene-record.json"),
    JSON.stringify(record, null, 2)
  );
  console.log("\nDone.");
  console.log(`Studio: https://www.asfins.com/studio/kitchen/${SCENE_ID}`);
  console.log(`Gallery bathroom: https://www.asfins.com/gallery/bathroom`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
