/**
 * Re-fetch every ZRK sheet from Strapi at near-original quality.
 * Replaces the old 768px / 320px heavily compressed webps.
 *
 * Full:   public/catalog-textures/zrk/{code}.webp     (≤2048, webp q=92)
 * Thumb:  public/catalog-textures/zrk/thumbs/{code}.webp (1024² demirrored crop, q=90)
 *
 * Product `image` → FULL texture (not thumbs).
 * Catalog `imageUrl` → full, `thumbUrl` → high-res card crop.
 *
 * Usage: node scripts/remirror-zrk-hq.mjs
 *        node scripts/remirror-zrk-hq.mjs --limit=20   # sample
 *        node scripts/remirror-zrk-hq.mjs --force
 */
import sharp from "sharp";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  collectAllProductPaths,
  scrapeDetails,
} from "./lib/zrk-scraper-cli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/catalog-textures/zrk");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const CATALOGS_PATH = path.join(ROOT, "data/catalogs.json");
const PRODUCTS_PATH = path.join(ROOT, "data/products.json");
const ZRK_ID = "zrk-group";
const CONCURRENCY = 6;
const FULL_MAX = 2048;
const THUMB_SIZE = 1024;
const FULL_QUALITY = 92;
const THUMB_QUALITY = 90;

const args = process.argv.slice(2);
const force = args.includes("--force");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
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

async function writeHqThumb(input, outPath) {
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

  await pipeline
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .webp({ quality: THUMB_QUALITY })
    .toFile(outPath);
}

async function mirrorOne(code, remoteUrl) {
  const thumbDisk = path.join(THUMB_DIR, `${code}.webp`);
  const fullDisk = path.join(OUT_DIR, `${code}.webp`);
  const thumbUrl = `/catalog-textures/zrk/thumbs/${code}.webp`;
  const imageUrl = `/catalog-textures/zrk/${code}.webp`;

  const hasBoth = (await fileExists(thumbDisk)) && (await fileExists(fullDisk));
  if (hasBoth && !force) {
    // Still upgrade if existing full is undersized (< 1500px)
    try {
      const meta = await sharp(fullDisk).metadata();
      if ((meta.width ?? 0) >= 1500 && (meta.height ?? 0) >= 1500) {
        return { code, thumbUrl, imageUrl, skipped: true, remoteUrl };
      }
    } catch {
      /* re-fetch */
    }
  }

  const res = await fetch(remoteUrl, {
    headers: { "User-Agent": "ASFins-ZRK-HQ-Mirror/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  // Near-original clarity — keep Strapi 2048 when present
  await sharp(buf)
    .resize(FULL_MAX, FULL_MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: FULL_QUALITY })
    .toFile(fullDisk);

  await writeHqThumb(buf, thumbDisk);

  return { code, thumbUrl, imageUrl, skipped: false, remoteUrl };
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

await mkdir(OUT_DIR, { recursive: true });
await mkdir(THUMB_DIR, { recursive: true });

console.log("Collecting ZRK product paths…");
let paths = await collectAllProductPaths();
if (limit > 0) paths = paths.slice(0, limit);
console.log(`Scraping Strapi URLs for ${paths.length} products…`);

const { rows, errors: scrapeErrors } = await scrapeDetails(paths);
console.log(`Got ${rows.length} image URLs (${scrapeErrors.length} scrape errors)\n`);

const catalogsData = JSON.parse(await readFile(CATALOGS_PATH, "utf8"));
const productsData = JSON.parse(await readFile(PRODUCTS_PATH, "utf8"));
const catalog = catalogsData.catalogs.find((c) => c.id === ZRK_ID);
if (!catalog) {
  console.error("zrk-group catalog not found");
  process.exit(1);
}

const byCodeRemote = new Map(rows.map((r) => [r.sheetCode, r]));

let done = 0;
let skipped = 0;
const errors = [...scrapeErrors];

const results = await mapPool(
  rows,
  async (row) => {
    try {
      const r = await mirrorOne(row.sheetCode, row.imageUrl);
      if (r.skipped) skipped++;
      else done++;
      if ((done + skipped) % 15 === 0) {
        console.log(
          `Progress ${done + skipped}/${rows.length} (${done} new, ${skipped} cached)`
        );
      }
      return r;
    } catch (e) {
      errors.push(`${row.sheetCode}: ${e.message}`);
      return null;
    }
  },
  CONCURRENCY
);

const byCode = new Map(results.filter(Boolean).map((r) => [r.code, r]));

for (const sw of catalog.swatches) {
  const m = byCode.get(sw.sheetCode);
  const remote = byCodeRemote.get(sw.sheetCode);
  if (m) {
    sw.imageUrl = m.imageUrl;
    sw.thumbUrl = m.thumbUrl;
  } else if (sw.sheetCode) {
    // Keep local full path even if remirror missed this code
    const localFull = `/catalog-textures/zrk/${sw.sheetCode}.webp`;
    const localThumb = `/catalog-textures/zrk/thumbs/${sw.sheetCode}.webp`;
    if (!sw.imageUrl?.includes("strapi.zrkgroup.com")) {
      sw.imageUrl = localFull;
      sw.thumbUrl = localThumb;
    }
  }
  if (remote) {
    if (remote.surfaceFinish && !sw.surfaceFinish) sw.surfaceFinish = remote.surfaceFinish;
    if (remote.materialCategory) sw.materialCategory = remote.materialCategory;
    if (remote.colorDescription && !sw.colorDescription) {
      sw.colorDescription = remote.colorDescription;
    }
  }
}

let productsUpdated = 0;
for (const p of productsData.products) {
  if (!p.id?.startsWith("zrk-")) continue;
  const code = p.productCode ?? p.id.replace(/^zrk-/, "");
  const m = byCode.get(code);
  const next = m?.imageUrl ?? `/catalog-textures/zrk/${code}.webp`;
  if (p.image !== next) {
    p.image = next;
    productsUpdated++;
  } else if (p.image?.includes("/thumbs/")) {
    p.image = next;
    productsUpdated++;
  }
  const remote = byCodeRemote.get(code);
  if (remote?.surfaceFinish && !p.surfaceFinish) p.surfaceFinish = remote.surfaceFinish;
  if (remote?.materialCategory) p.materialCategory = remote.materialCategory;
}

await writeFile(CATALOGS_PATH, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS_PATH, JSON.stringify(productsData, null, 2) + "\n");

const stillThumbs = productsData.products.filter(
  (p) => p.id?.startsWith("zrk-") && p.image?.includes("/thumbs/")
).length;
const onFull = productsData.products.filter(
  (p) => p.id?.startsWith("zrk-") && p.image && !p.image.includes("/thumbs/")
).length;

console.log(`\nDone — ${done} downloaded, ${skipped} cached HQ, ${errors.length} errors`);
console.log(`Products updated: ${productsUpdated}`);
console.log(`ZRK products on full: ${onFull}, still on thumbs: ${stillThumbs}`);
if (errors.length) console.log(errors.slice(0, 20).join("\n"));
console.log(
  "\nNext: npm run upload-r2  (push HQ files + rewrite to R2 public URLs)"
);
console.log("Then: npm run seed-mongo");
