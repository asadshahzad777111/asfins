/**
 * Analyze layer + mask files for a scene zone.
 * Usage: node scripts/analyze-mask.mjs [sceneId] [zoneId]
 * Example: node scripts/analyze-mask.mjs kitchen-real cabinets
 */
import sharp from "sharp";
import { access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  analyzeMaskBuffer,
  analyzeLayerBuffer,
  isLayerBackground,
  BLACK_THRESHOLD,
  LUM_THRESHOLD,
} from "./lib/mask-from-layer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sceneId = process.argv[2] ?? "kitchen-real";
const zoneId = process.argv[3] ?? "cabinets";
const DIR = path.join(__dirname, "../public/scenes", sceneId);

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const basePath = path.join(DIR, "base.jpg");
const layerPath = path.join(DIR, `layer-${zoneId}.png`);
const maskPath = path.join(DIR, `mask-${zoneId}.png`);

for (const [label, p] of [
  ["base.jpg", basePath],
  ["layer", layerPath],
  ["mask", maskPath],
]) {
  if (!(await exists(p))) {
    console.error(`Missing ${label}: ${p}`);
    process.exit(1);
  }
}

const baseMeta = await sharp(basePath).metadata();
const layerMeta = await sharp(layerPath).metadata();
const maskMeta = await sharp(maskPath).metadata();

console.log(`Scene: ${sceneId} / zone: ${zoneId}`);
console.log(`Base:  ${baseMeta.width}x${baseMeta.height}`);
console.log(`Layer: ${layerMeta.width}x${layerMeta.height}`);
console.log(`Mask:  ${maskMeta.width}x${maskMeta.height}`);

if (
  baseMeta.width !== maskMeta.width ||
  baseMeta.height !== maskMeta.height
) {
  console.warn("⚠ Mask dimensions do not match base photo!");
}

const W = baseMeta.width;
const H = baseMeta.height;

const layerRaw = await sharp(layerPath).resize(W, H).ensureAlpha().raw().toBuffer();
const maskRaw = await sharp(maskPath).resize(W, H).ensureAlpha().raw().toBuffer();

const layerStats = analyzeLayerBuffer(layerRaw, W, H);
const maskStats = analyzeMaskBuffer(maskRaw, W, H);

console.log("\nLayer foreground:", `${layerStats.foregroundPercent}%`);
console.log("Mask active:", `${maskStats.activePercent}%`);
console.log("Thresholds: BLACK=", BLACK_THRESHOLD, "LUM=", LUM_THRESHOLD);

if (layerStats.looksFullImage) {
  console.warn("DIAGNOSIS: Layer cutout covers most of image — NOT pure black bg cutout");
} else if (maskStats.looksFullImage) {
  console.warn("DIAGNOSIS: Mask covers most of image — bad generation or bad layer");
} else if (maskStats.looksReasonable) {
  console.log("DIAGNOSIS: Mask looks OK for cabinet recolor zone");
}

// Sample inverted check: if >50% of mask is bright, might be inverted
let brightMask = 0;
for (let i = 0; i < W * H; i++) {
  const mi = i * 4;
  const lum = 0.299 * maskRaw[mi] + 0.587 * maskRaw[mi + 1] + 0.114 * maskRaw[mi + 2];
  if (lum > 200 && maskRaw[mi + 3] > 200) brightMask++;
}
const brightPct = (brightMask / (W * H)) * 100;
console.log(`Bright mask pixels (>200 lum): ${brightPct.toFixed(2)}%`);
