/**
 * Aapki kitchen photo + cabinet layer se mask banata hai.
 *
 * INPUT (public/scenes/kitchen-real/):
 *   base.png           — poori kitchen photo
 *   layer-cabinets.png — cabinets cutout, black background
 *
 * OUTPUT:
 *   base.jpg, mask-cabinets.png, highlight-gloss.png, night-glow.png
 */
import sharp from "sharp";
import { mkdir, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildMaskPixels,
  analyzeMaskBuffer,
  analyzeLayerBuffer,
  BLACK_THRESHOLD,
} from "./lib/mask-from-layer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../public/scenes/kitchen-real");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildMaskFromLayer(basePath, layerPath, outPath) {
  const baseMeta = await sharp(basePath).metadata();
  const layerMeta = await sharp(layerPath).metadata();
  const W = baseMeta.width;
  const H = baseMeta.height;

  if (layerMeta.width !== W || layerMeta.height !== H) {
    console.warn(
      `Layer ${layerMeta.width}x${layerMeta.height} → resized to base ${W}x${H}`
    );
  }

  const baseRaw = await sharp(basePath)
    .resize(W, H)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const layerRaw = await sharp(layerPath)
    .resize(W, H)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const layerStats = analyzeLayerBuffer(layerRaw, W, H);
  const { mask } = buildMaskPixels(baseRaw, layerRaw, W, H);
  const maskStats = analyzeMaskBuffer(mask, W, H);

  await sharp(mask, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outPath);

  return { W, H, layerStats, maskStats };
}

async function minimalOverlays(W, H) {
  const highlight = Buffer.from(
    `<svg width="${W}" height="${H}"><ellipse cx="${W * 0.5}" cy="${H * 0.35}" rx="${W * 0.25}" ry="${H * 0.12}" fill="white" opacity="0.2"/></svg>`
  );
  await sharp(highlight).png().toFile(path.join(DIR, "highlight-gloss.png"));

  const glow = Buffer.from(
    `<svg width="${W}" height="${H}"><radialGradient id="g"><stop offset="0%" stop-color="#ffb870" stop-opacity="0.6"/><stop offset="100%" stop-color="#ffb870" stop-opacity="0"/></radialGradient><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(glow).png().toFile(path.join(DIR, "night-glow.png"));
}

function printStats(layerStats, maskStats) {
  console.log("\n--- Layer cutout stats ---");
  console.log(`  Foreground (cabinet) pixels: ${layerStats.foregroundPercent}%`);
  console.log(`  Near-black noise pixels:     ${layerStats.nearBlackNoisePixels}`);
  if (layerStats.hint) console.warn(`  ⚠ ${layerStats.hint}`);

  console.log("\n--- Generated mask stats ---");
  console.log(`  Active (white) pixels: ${maskStats.activePercent}%`);
  console.log(`  Avg luminance:         ${maskStats.avgLuminance}`);
  if (maskStats.bounds) {
    const b = maskStats.bounds;
    console.log(
      `  Bounds: x=${b.minX}-${b.maxX}, y=${b.minY}-${b.maxY} (${b.width}x${b.height})`
    );
  }
  if (maskStats.looksFullImage) {
    console.warn(
      `  ⚠ Mask covers ${maskStats.activePercent}% of image — layer cutout is likely wrong`
    );
    console.warn(
      "  Upload: cabinets ONLY on pure #000000 background, same size as base photo"
    );
  } else if (maskStats.looksReasonable) {
    console.log("  ✓ Mask coverage looks reasonable for cabinet zone");
  }
  console.log(`  Black threshold used: max(R,G,B) <= ${BLACK_THRESHOLD}`);
}

await mkdir(DIR, { recursive: true });

const basePng = path.join(DIR, "base.png");
const baseJpg = path.join(DIR, "base.jpg");
const layerPng = path.join(DIR, "layer-cabinets.png");

if (!(await exists(basePng)) && !(await exists(baseJpg))) {
  console.error("Missing: public/scenes/kitchen-real/base.png");
  console.error("Aapki kitchen photo wahan rakhein, phir dubara chalayein.");
  process.exit(1);
}
if (!(await exists(layerPng))) {
  console.error("Missing: public/scenes/kitchen-real/layer-cabinets.png");
  console.error("Cabinets cutout (black bg) wahan rakhein.");
  process.exit(1);
}

const baseSrc = (await exists(basePng)) ? basePng : baseJpg;
if (await exists(basePng)) {
  await sharp(basePng).jpeg({ quality: 92 }).toFile(baseJpg);
} else if (baseSrc !== baseJpg) {
  await sharp(baseSrc).jpeg({ quality: 92 }).toFile(baseJpg);
}

const { W, H, layerStats, maskStats } = await buildMaskFromLayer(
  baseJpg,
  layerPng,
  path.join(DIR, "mask-cabinets.png")
);
await minimalOverlays(W, H);

console.log(`\nDone — ${W}x${H}`);
console.log("  base.jpg, mask-cabinets.png ready");
printStats(layerStats, maskStats);
console.log("\nAb: npm run dev → /configurator/kitchen-real");
