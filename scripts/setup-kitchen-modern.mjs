/**
 * Setup kitchen-modern from base photo.
 * Auto-detects black cabinet pixels → precise mask (not rectangles).
 *
 * Run: npm run setup-kitchen-modern
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  analyzeMaskBuffer,
  morphOpen,
  morphClose,
} from "./lib/mask-from-layer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../public/scenes/kitchen-modern");

/** Black cabinet pixels in photo — tuned for dark flat cabinet fronts */
const CABINET_MAX = 50;
const CABINET_LUM_MAX = 55;

function isCabinetPixel(r, g, b, y, H) {
  if (y > H * 0.87) return false;
  const maxC = Math.max(r, g, b);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return maxC <= CABINET_MAX && lum <= CABINET_LUM_MAX;
}

async function buildCabinetMaskFromPhoto(basePath, outPath) {
  const meta = await sharp(basePath).metadata();
  const W = meta.width;
  const H = meta.height;

  const baseRaw = await sharp(basePath).ensureAlpha().raw().toBuffer();
  const binary = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const pi = i * 4;
      if (isCabinetPixel(baseRaw[pi], baseRaw[pi + 1], baseRaw[pi + 2], y, H)) {
        binary[i] = 1;
      }
    }
  }

  const cleaned = morphClose(morphOpen(binary, W, H, 1), W, H, 1);
  const mask = Buffer.alloc(W * H * 4);

  for (let i = 0; i < W * H; i++) {
    const mi = i * 4;
    if (!cleaned[i]) {
      mask[mi] = mask[mi + 1] = mask[mi + 2] = mask[mi + 3] = 0;
      continue;
    }
    mask[mi] = mask[mi + 1] = mask[mi + 2] = 255;
    mask[mi + 3] = 255;
  }

  await sharp(mask, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outPath);

  return { W, H, stats: analyzeMaskBuffer(mask, W, H) };
}

async function overlays(W, H) {
  const highlight = Buffer.from(
    `<svg width="${W}" height="${H}"><ellipse cx="${W * 0.45}" cy="${H * 0.28}" rx="${W * 0.22}" ry="${H * 0.1}" fill="white" opacity="0.18"/></svg>`
  );
  await sharp(highlight).png().toFile(path.join(DIR, "highlight-gloss.png"));

  const glow = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="g"><stop offset="0%" stop-color="#ffb870" stop-opacity="0.55"/><stop offset="100%" stop-color="#ffb870" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(glow).png().toFile(path.join(DIR, "night-glow.png"));
}

await mkdir(DIR, { recursive: true });

const basePng = path.join(DIR, "base.png");
const baseJpg = path.join(DIR, "base.jpg");
const thumbJpg = path.join(DIR, "thumb.jpg");
const maskPath = path.join(DIR, "mask-cabinets.png");

if (!(await sharp(basePng).metadata().catch(() => null))) {
  console.error("Missing base.png");
  process.exit(1);
}

await sharp(basePng).jpeg({ quality: 90 }).toFile(baseJpg);
await sharp(baseJpg).resize(400, 267, { fit: "cover" }).jpeg({ quality: 82 }).toFile(thumbJpg);

const { W, H, stats } = await buildCabinetMaskFromPhoto(basePng, maskPath);
await overlays(W, H);

console.log(`kitchen-modern: ${W}x${H}`);
console.log(`Mask active: ${stats.activePercent}%`);
if (stats.bounds) {
  console.log(`Bounds: x=${stats.bounds.minX}-${stats.bounds.maxX}, y=${stats.bounds.minY}-${stats.bounds.maxY}`);
}
console.log(stats.looksReasonable ? "Mask OK — follows black cabinets." : "Check mask — upload your own PNG in admin.");
console.log("Done.");
