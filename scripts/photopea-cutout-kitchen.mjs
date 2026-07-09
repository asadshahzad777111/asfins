/**
 * Photopea-style cutout for AI kitchen photos.
 *
 * 1. Detects solid black / near-black cabinet paint regions
 * 2. Writes cutout.png — original photo with those regions TRANSPARENT
 * 3. Writes mask-*.png — white = colour zone (for canvas engine)
 *
 * Usage:
 *   node scripts/photopea-cutout-kitchen.mjs kitchen-modern
 *   node scripts/photopea-cutout-kitchen.mjs kitchen-1 --from=kitchen-modern
 */
import sharp from "sharp";
import { mkdir, copyFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  analyzeMaskBuffer,
  morphOpen,
  morphClose,
} from "./lib/mask-from-layer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCENES = path.join(__dirname, "../public/scenes");

const targetId = process.argv[2] ?? "kitchen-1";
const fromArg = process.argv.find((a) => a.startsWith("--from="));
const sourceId = fromArg ? fromArg.split("=")[1] : targetId;

/** Near-black painted cabinet faces in AI kitchen edits */
const MAX_CHANNEL = 48;
const MAX_LUM = 52;

function isCabinetPixel(r, g, b, a, y, H) {
  if (a < 20) return false;
  // Skip floor band — avoid dark wood floor false positives
  if (y > H * 0.9) return false;
  const maxC = Math.max(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const chroma = maxC - Math.min(r, g, b);
  // Flat black paint: dark + low chroma (not wood grain / shadows)
  return maxC <= MAX_CHANNEL && lum <= MAX_LUM && chroma <= 28;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadBase(dir) {
  const png = path.join(dir, "base.png");
  const jpg = path.join(dir, "base.jpg");
  if (await exists(png)) return png;
  if (await exists(jpg)) return jpg;
  return null;
}

async function buildBinary(basePath) {
  const meta = await sharp(basePath).metadata();
  const W = meta.width;
  const H = meta.height;
  const raw = await sharp(basePath).ensureAlpha().raw().toBuffer();
  const binary = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const pi = i * 4;
      if (
        isCabinetPixel(
          raw[pi],
          raw[pi + 1],
          raw[pi + 2],
          raw[pi + 3],
          y,
          H
        )
      ) {
        binary[i] = 1;
      }
    }
  }

  // Clean edges like careful Photopea erase
  const cleaned = morphClose(morphOpen(binary, W, H, 1), W, H, 2);
  return { W, H, raw, binary: cleaned };
}

function binaryToMaskRgba(binary, W, H) {
  const mask = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const mi = i * 4;
    if (binary[i]) {
      mask[mi] = mask[mi + 1] = mask[mi + 2] = 255;
      mask[mi + 3] = 255;
    }
  }
  return mask;
}

/** Original photo with cabinet pixels fully transparent (Photopea cutout) */
function binaryToCutoutRgba(raw, binary, W, H) {
  const out = Buffer.from(raw);
  for (let i = 0; i < W * H; i++) {
    if (!binary[i]) continue;
    const pi = i * 4;
    out[pi] = out[pi + 1] = out[pi + 2] = 0;
    out[pi + 3] = 0;
  }
  return out;
}

/** Split upper vs lower cabinets by vertical band (optional multi-zone) */
function splitUpperLower(binary, W, H) {
  const upper = new Uint8Array(W * H);
  const lower = new Uint8Array(W * H);
  const midY = Math.floor(H * 0.42);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!binary[i]) continue;
      if (y < midY) upper[i] = 1;
      else lower[i] = 1;
    }
  }
  return { upper, lower };
}

async function overlays(dir, W, H) {
  const highlight = Buffer.from(
    `<svg width="${W}" height="${H}"><ellipse cx="${W * 0.45}" cy="${H * 0.28}" rx="${W * 0.22}" ry="${H * 0.1}" fill="white" opacity="0.16"/></svg>`
  );
  await sharp(highlight).png().toFile(path.join(dir, "highlight-gloss.png"));

  const glow = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="g"><stop offset="0%" stop-color="#ffb870" stop-opacity="0.5"/><stop offset="100%" stop-color="#ffb870" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(glow).png().toFile(path.join(dir, "night-glow.png"));
}

const sourceDir = path.join(SCENES, sourceId);
const targetDir = path.join(SCENES, targetId);
await mkdir(targetDir, { recursive: true });

const sourceBase = await loadBase(sourceDir);
if (!sourceBase) {
  console.error(`Missing base image in ${sourceDir}`);
  process.exit(1);
}

// Copy / normalize base into target (avoid same-file sharp I/O)
const targetPng = path.join(targetDir, "base.png");
const targetJpg = path.join(targetDir, "base.jpg");
const targetThumb = path.join(targetDir, "thumb.jpg");
const workPng = path.join(targetDir, "_work-base.png");

await sharp(sourceBase).png().toFile(workPng);
if (path.resolve(sourceBase) !== path.resolve(targetPng)) {
  await sharp(workPng).png().toFile(targetPng);
} else {
  // already have base.png — keep work copy for processing
}
await sharp(workPng).jpeg({ quality: 90 }).toFile(targetJpg);
await sharp(workPng)
  .resize(480, 320, { fit: "cover" })
  .jpeg({ quality: 82 })
  .toFile(targetThumb);

const { W, H, raw, binary } = await buildBinary(workPng);
const maskRgba = binaryToMaskRgba(binary, W, H);
const cutoutRgba = binaryToCutoutRgba(raw, binary, W, H);
const { upper, lower } = splitUpperLower(binary, W, H);

await sharp(maskRgba, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toFile(path.join(targetDir, "mask-cabinets.png"));

await sharp(binaryToMaskRgba(upper, W, H), {
  raw: { width: W, height: H, channels: 4 },
})
  .png()
  .toFile(path.join(targetDir, "mask-upper-cabinets.png"));

await sharp(binaryToMaskRgba(lower, W, H), {
  raw: { width: W, height: H, channels: 4 },
})
  .png()
  .toFile(path.join(targetDir, "mask-lower-cabinets.png"));

// Photopea-style master cutout (transparent holes)
await sharp(cutoutRgba, { raw: { width: W, height: H, channels: 4 } })
  .png()
  .toFile(path.join(targetDir, "cutout.png"));

// Also store as layer for admin/debug
await copyFile(
  path.join(targetDir, "cutout.png"),
  path.join(targetDir, "layer-cabinets.png")
);

await overlays(targetDir, W, H);

// Ensure base.png exists for target
if (!(await exists(targetPng))) {
  await copyFile(workPng, targetPng);
}
try {
  await access(workPng);
  const { unlink } = await import("fs/promises");
  await unlink(workPng).catch(() => {});
} catch {
  /* ignore */
}

const stats = analyzeMaskBuffer(maskRgba, W, H);
const upperStats = analyzeMaskBuffer(binaryToMaskRgba(upper, W, H), W, H);
const lowerStats = analyzeMaskBuffer(binaryToMaskRgba(lower, W, H), W, H);

console.log(`\nPhotopea cutout → ${targetId} (from ${sourceId})`);
console.log(`Size: ${W}x${H}`);
console.log(`Cabinets mask: ${stats.activePercent}%`);
console.log(`  Upper: ${upperStats.activePercent}%`);
console.log(`  Lower: ${lowerStats.activePercent}%`);
if (stats.bounds) {
  console.log(
    `Bounds: x=${stats.bounds.minX}-${stats.bounds.maxX}, y=${stats.bounds.minY}-${stats.bounds.maxY}`
  );
}
console.log(
  stats.looksReasonable
    ? "OK — black cabinet regions → transparent cutout + masks"
    : "WARN — check cutout.png / mask-cabinets.png"
);
console.log(`Files: cutout.png, mask-cabinets.png, mask-upper/lower-cabinets.png`);
console.log("Done.");
