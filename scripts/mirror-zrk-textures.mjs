/**
 * Mirror ALL ZRK Strapi images → local webp (fast catalog loading).
 * Creates thumb (1024px demirrored) + full (≤2048px, q=92) for every zrk-group swatch.
 * Product cards use the FULL texture URL (not thumbs).
 *
 * Usage: npm run mirror-zrk
 * Prefer scripts/remirror-zrk-hq.mjs to force-refresh from Strapi at HQ.
 */
import sharp from "sharp";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/catalog-textures/zrk");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const CATALOGS_PATH = path.join(ROOT, "data/catalogs.json");
const PRODUCTS_PATH = path.join(ROOT, "data/products.json");
const ZRK_ID = "zrk-group";
const CONCURRENCY = 8;

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function isRemote(url) {
  return url && /^https?:\/\/strapi\.zrkgroup\.com\//i.test(url);
}

async function mirrorOne(code, remoteUrl, force = false) {
  const thumbDisk = path.join(THUMB_DIR, `${code}.webp`);
  const fullDisk = path.join(OUT_DIR, `${code}.webp`);
  const thumbUrl = `/catalog-textures/zrk/thumbs/${code}.webp`;
  const imageUrl = `/catalog-textures/zrk/${code}.webp`;

  const hasBoth = (await fileExists(thumbDisk)) && (await fileExists(fullDisk));
  if (hasBoth && !force) {
    return { code, thumbUrl, imageUrl, skipped: true };
  }

  const res = await fetch(remoteUrl, {
    headers: { "User-Agent": "ArtisanInteriors-ZRK-Mirror/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // Full sheet stays book-matched for seamless studio tiling (near-Strapi quality).
  await sharp(buf)
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92 })
    .toFile(fullDisk);

  // Catalog thumb: crop away mirror seam when the Strapi sheet is book-matched.
  await writeDemirroredThumb(buf, thumbDisk, 1024);

  return { code, thumbUrl, imageUrl, skipped: false };
}

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
  };
}

async function writeDemirroredThumb(input, outPath, size = 320) {
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

async function mapPool(items, fn, n) {
  let idx = 0;
  const results = [];
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

const catalogsData = JSON.parse(await readFile(CATALOGS_PATH, "utf8"));
const productsData = JSON.parse(await readFile(PRODUCTS_PATH, "utf8"));
const catalog = catalogsData.catalogs.find((c) => c.id === ZRK_ID);
if (!catalog) {
  console.error("zrk-group catalog not found");
  process.exit(1);
}

const force = process.argv.includes("--force");
const toMirror = catalog.swatches
  .filter((s) => s.sheetCode && isRemote(s.imageUrl))
  .map((s) => ({ code: s.sheetCode, url: s.imageUrl }));

const alreadyLocal = catalog.swatches.filter(
  (s) => s.imageUrl?.startsWith("/catalog-textures/")
).length;

console.log(`ZRK mirror — ${toMirror.length} remote, ${alreadyLocal} already local\n`);
if (toMirror.length === 0) {
  console.log("Nothing to mirror — catalog already uses local images.");
  process.exit(0);
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(THUMB_DIR, { recursive: true });

const errors = [];
let done = 0;
let skipped = 0;

const results = await mapPool(
  toMirror,
  async (item) => {
    try {
      const r = await mirrorOne(item.code, item.url, force);
      if (r.skipped) skipped++;
      else done++;
      if ((done + skipped) % 20 === 0) {
        console.log(`Progress ${done + skipped}/${toMirror.length} (${done} new, ${skipped} cached)`);
      }
      return r;
    } catch (e) {
      errors.push(`${item.code}: ${e.message}`);
      return null;
    }
  },
  CONCURRENCY
);

const byCode = new Map(results.filter(Boolean).map((r) => [r.code, r]));

for (const sw of catalog.swatches) {
  const m = byCode.get(sw.sheetCode);
  if (m) {
    sw.imageUrl = m.imageUrl;
    sw.thumbUrl = m.thumbUrl;
  } else if (sw.imageUrl?.startsWith("/catalog-textures/zrk/") && !sw.thumbUrl) {
    sw.thumbUrl = `/catalog-textures/zrk/thumbs/${sw.sheetCode}.webp`;
  }
}

for (const p of productsData.products) {
  if (!p.id?.startsWith("zrk-")) continue;
  const code = p.productCode ?? p.id.replace("zrk-", "");
  const m = byCode.get(code);
  if (m) p.image = m.imageUrl;
  else if (p.image?.includes("/thumbs/")) {
    p.image = `/catalog-textures/zrk/${code}.webp`;
  }
}

await writeFile(CATALOGS_PATH, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS_PATH, JSON.stringify(productsData, null, 2) + "\n");

console.log(`\nDone — ${done} downloaded, ${skipped} cached, ${errors.length} errors`);
if (errors.length) console.log(errors.slice(0, 10).join("\n"));
console.log("Catalog ab local images use karega — fast loading!");
