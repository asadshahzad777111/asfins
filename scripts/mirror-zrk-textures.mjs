/**
 * Mirror ALL ZRK Strapi images → local webp (fast catalog loading).
 * Creates thumb (320px) + full (768px) for every zrk-group swatch.
 *
 * Usage: npm run mirror-zrk
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

  await sharp(buf)
    .resize(768, 768, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(fullDisk);

  await sharp(buf)
    .resize(320, 320, { fit: "cover" })
    .webp({ quality: 78 })
    .toFile(thumbDisk);

  return { code, thumbUrl, imageUrl, skipped: false };
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
  if (m) p.image = m.thumbUrl;
  else if (p.image?.startsWith("/catalog-textures/zrk/") && !p.image.includes("/thumbs/")) {
    p.image = `/catalog-textures/zrk/thumbs/${code}.webp`;
  }
}

await writeFile(CATALOGS_PATH, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS_PATH, JSON.stringify(productsData, null, 2) + "\n");

console.log(`\nDone — ${done} downloaded, ${skipped} cached, ${errors.length} errors`);
if (errors.length) console.log(errors.slice(0, 10).join("\n"));
console.log("Catalog ab local images use karega — fast loading!");
