/**
 * Re-crop ZRK catalog thumbs that are book-matched / mirrored seamless tiles.
 * Full textures under public/catalog-textures/zrk/*.webp are LEFT ALONE
 * (studio tiling still needs the seamless sheet).
 *
 * Usage: node scripts/fix-zrk-mirrored-thumbs.mjs
 */
import sharp from "sharp";
import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FULL_DIR = path.join(ROOT, "public/catalog-textures/zrk");
const THUMB_DIR = path.join(FULL_DIR, "thumbs");

async function detectMirrorAxes(input) {
  const { data, info } = await sharp(input)
    .resize(256, 256, { fit: "fill" })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const mid = Math.floor(w / 2);
  const midY = Math.floor(h / 2);

  let mean = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    mean += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  mean /= pixels;

  let varSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
    varSum += (v - mean) ** 2;
  }
  const std = Math.sqrt(varSum / pixels);

  let lrSum = 0;
  let lrN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < mid; x++) {
      const li = (y * w + x) * 4;
      const ri = (y * w + (w - 1 - x)) * 4;
      lrSum +=
        (Math.abs(data[li] - data[ri]) +
          Math.abs(data[li + 1] - data[ri + 1]) +
          Math.abs(data[li + 2] - data[ri + 2])) /
        3;
      lrN++;
    }
  }

  let tbSum = 0;
  let tbN = 0;
  for (let y = 0; y < midY; y++) {
    for (let x = 0; x < w; x++) {
      const ti = (y * w + x) * 4;
      const bi = ((h - 1 - y) * w + x) * 4;
      tbSum +=
        (Math.abs(data[ti] - data[bi]) +
          Math.abs(data[ti + 1] - data[bi + 1]) +
          Math.abs(data[ti + 2] - data[bi + 2])) /
        3;
      tbN++;
    }
  }

  const lr = lrSum / Math.max(1, lrN);
  const tb = tbSum / Math.max(1, tbN);
  const threshold = Math.max(10, std * 0.9);
  const textured = std >= 5;

  return {
    leftRight: textured && lr < threshold,
    topBottom: textured && tb < threshold,
    std,
    lr,
    tb,
  };
}

async function writeDemirroredThumb(input, outPath, size = 1024) {
  const axes = await detectMirrorAxes(input);
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  let pipeline = sharp(input);
  if ((axes.leftRight || axes.topBottom) && w >= 8 && h >= 8) {
    const cropW = axes.leftRight ? Math.max(1, Math.floor(w / 2)) : w;
    const cropH = axes.topBottom ? Math.max(1, Math.floor(h / 2)) : h;
    pipeline = pipeline.extract({ left: 0, top: 0, width: cropW, height: cropH });
  }

  await pipeline.resize(size, size, { fit: "cover" }).webp({ quality: 90 }).toFile(outPath);
  return axes;
}

const files = (await readdir(FULL_DIR)).filter(
  (f) => f.endsWith(".webp") && !f.includes(path.sep)
);

let fixed = 0;
let skipped = 0;
const samples = [];

for (const file of files) {
  const fullPath = path.join(FULL_DIR, file);
  const thumbPath = path.join(THUMB_DIR, file);
  try {
    const axes = await writeDemirroredThumb(fullPath, thumbPath, 1024);
    if (axes.leftRight || axes.topBottom) {
      fixed++;
      if (samples.length < 30) {
        samples.push(
          `${file} lr=${axes.leftRight} tb=${axes.topBottom} (diff lr=${axes.lr.toFixed(1)} tb=${axes.tb.toFixed(1)} std=${axes.std.toFixed(1)})`
        );
      }
    } else {
      skipped++;
    }
  } catch (e) {
    console.error("fail", file, e.message);
  }
}

console.log(`\nDone — demirrored thumbs: ${fixed}, unchanged: ${skipped}, total: ${files.length}`);
console.log(samples.join("\n"));
