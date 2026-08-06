/**
 * Re-fetch every Patex Lamination sheet from patex.com.pk at near-original quality.
 * Replaces the old 768px / 320px heavily compressed webps.
 *
 * Full:   public/catalog-textures/patex/{code}.webp     (≤2048, webp q=92)
 * Thumb:  public/catalog-textures/patex/thumbs/{code}.webp (1024² cover, q=90)
 *
 * Product `image` → FULL texture (not thumbs).
 * Catalog `imageUrl` → full, `thumbUrl` → high-res card crop.
 *
 * Also flips Patex Elegance shop cards from /thumbs/ → full (no re-extract without PDF).
 *
 * Usage: node scripts/remirror-patex-hq.mjs
 *        node scripts/remirror-patex-hq.mjs --limit=20
 *        node scripts/remirror-patex-hq.mjs --force
 */
import sharp from "sharp";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/catalog-textures/patex");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const RAW = path.join(ROOT, "data/patex-raw");
const SCRAPED_OUT = path.join(ROOT, "data/patex-lamination-scraped.json");
const CATALOGS_PATH = path.join(ROOT, "data/catalogs.json");
const PRODUCTS_PATH = path.join(ROOT, "data/products.json");
const PATEX_ID = "patex";
const PUBLIC_R2 =
  process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ||
  "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev";

const CONCURRENCY = 6;
const FULL_MAX = 2048;
const THUMB_SIZE = 1024;
const FULL_QUALITY = 92;
const THUMB_QUALITY = 90;
const MIN_FULL_EDGE = 1400;
const UA = "Mozilla/5.0 (compatible; ASFins-Patex-HQ-Mirror/1.0; +https://asfins.com)";

const args = process.argv.slice(2);
const force = args.includes("--force");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function safeCode(sheetCode) {
  return String(sheetCode || "unknown")
    .replace(/^PK-/i, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-");
}

function extractSheetCode(title, slug) {
  const t = String(title || "");
  const m =
    t.match(/\b(PK[-\s]?[\d]+[A-Za-z]?)\b/i) ||
    t.match(/\b(EP[-\s]?[\d]+)\b/i) ||
    String(slug || "").match(/\b(pk[-\s]?[\d]+[a-z]?)\b/i);
  if (!m) {
    const num = t.match(/\b(\d{3,5}[A-Za-z]?)\b/);
    return num ? `PK-${num[1].toUpperCase()}` : String(slug || "").toUpperCase();
  }
  return m[1].toUpperCase().replace(/\s+/g, "-").replace(/^PK(?=\d)/, "PK-");
}

function proxyFull(remoteUrl) {
  // Full fidelity via wsrv (no width cap). Hostinger CDN often blocks datacenter IPs.
  return `https://wsrv.nl/?url=${encodeURIComponent(remoteUrl)}&n=-1&output=jpg&q=95`;
}

async function downloadBuffer(remoteUrl) {
  const attempts = [
    remoteUrl,
    proxyFull(remoteUrl),
    `https://web.archive.org/web/2id_/${remoteUrl}`,
  ];
  let lastErr = "unknown";
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        redirect: "follow",
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) {
        lastErr = `tiny body ${buf.length}`;
        continue;
      }
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
        lastErr = `tiny dims ${meta.width}x${meta.height}`;
        continue;
      }
      return buf;
    } catch (e) {
      lastErr = e.message;
    }
    await sleep(40);
  }
  throw new Error(lastErr);
}

async function mirrorOne(code, remoteUrl) {
  const thumbDisk = path.join(THUMB_DIR, `${code}.webp`);
  const fullDisk = path.join(OUT_DIR, `${code}.webp`);
  const thumbUrl = `${PUBLIC_R2}/catalog-textures/patex/thumbs/${code}.webp`;
  const imageUrl = `${PUBLIC_R2}/catalog-textures/patex/${code}.webp`;

  const hasBoth = (await fileExists(thumbDisk)) && (await fileExists(fullDisk));
  if (hasBoth && !force) {
    try {
      const meta = await sharp(fullDisk).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (Math.max(w, h) >= MIN_FULL_EDGE) {
        return { code, thumbUrl, imageUrl, skipped: true, remoteUrl };
      }
    } catch {
      /* re-fetch */
    }
  }

  const buf = await downloadBuffer(remoteUrl);

  await sharp(buf)
    .resize(FULL_MAX, FULL_MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: FULL_QUALITY })
    .toFile(fullDisk);

  await sharp(buf)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .webp({ quality: THUMB_QUALITY })
    .toFile(thumbDisk);

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

const productsRaw = JSON.parse(
  await readFile(path.join(RAW, "products-page-1.json"), "utf8")
);
const mediaKnown = JSON.parse(
  await readFile(path.join(RAW, "media-known.json"), "utf8")
);
const mediaMap = new Map(mediaKnown.map((m) => [m.id, m.source_url]));

let rows = productsRaw.map((p) => {
  const title = typeof p.title === "string" ? p.title : p.title?.rendered || "";
  const sheetCode = extractSheetCode(title, p.slug);
  return {
    sheetCode,
    name: String(title).replace(/\.jpg$/i, "").trim(),
    imageUrl: mediaMap.get(p.featured_media) || "",
    sourceUrl: p.link,
    slug: p.slug,
    featured_media: p.featured_media,
    pricePKR: 0,
    dimensions: "2440*1220",
    thickness: "16mm",
    materialCategory: "Patex Lamination",
    brandName: "Patex",
  };
});

const missingMedia = rows.filter((r) => !r.imageUrl);
rows = rows.filter((r) => r.imageUrl);
if (limit > 0) rows = rows.slice(0, limit);

await mkdir(OUT_DIR, { recursive: true });
await mkdir(THUMB_DIR, { recursive: true });

console.log(
  `Remirroring ${rows.length} Patex Lamination textures (${missingMedia.length} missing media)…\n`
);

let done = 0;
let skipped = 0;
const errors = [];

const results = await mapPool(
  rows,
  async (row) => {
    const code = safeCode(row.sheetCode);
    try {
      const r = await mirrorOne(code, row.imageUrl);
      if (r.skipped) skipped++;
      else done++;
      if ((done + skipped) % 15 === 0) {
        console.log(
          `Progress ${done + skipped}/${rows.length} (${done} new, ${skipped} cached)`
        );
      }
      return { ...r, sheetCode: row.sheetCode };
    } catch (e) {
      errors.push(`${row.sheetCode}: ${e.message}`);
      return null;
    }
  },
  CONCURRENCY
);

const byCode = new Map(
  results.filter(Boolean).map((r) => [String(r.sheetCode), r])
);
const bySafe = new Map(results.filter(Boolean).map((r) => [r.code, r]));

const catalogsData = JSON.parse(await readFile(CATALOGS_PATH, "utf8"));
const productsData = JSON.parse(await readFile(PRODUCTS_PATH, "utf8"));
const catalog = catalogsData.catalogs.find((c) => c.id === PATEX_ID);
if (!catalog) {
  console.error("patex catalog not found");
  process.exit(1);
}

let swatchesUpdated = 0;
for (const sw of catalog.swatches) {
  const m = byCode.get(String(sw.sheetCode)) || bySafe.get(safeCode(sw.sheetCode));
  if (!m) continue;
  if (sw.imageUrl !== m.imageUrl || sw.thumbUrl !== m.thumbUrl) swatchesUpdated++;
  sw.imageUrl = m.imageUrl;
  sw.thumbUrl = m.thumbUrl;
}

let productsUpdated = 0;
for (const p of productsData.products) {
  if (!p.id?.startsWith("patex-") || p.id.startsWith("patex-el-")) continue;
  if (p.materialCategory && p.materialCategory !== "Patex Lamination") continue;
  const code = safeCode(p.productCode ?? p.id.replace(/^patex-/, ""));
  const m = bySafe.get(code);
  const next =
    m?.imageUrl ?? `${PUBLIC_R2}/catalog-textures/patex/${code}.webp`;
  if (p.image !== next) {
    p.image = next;
    productsUpdated++;
  }
}

// Elegance: point shop cards at full textures (skip inactive designer pages)
let eleganceUpdated = 0;
for (const p of productsData.products) {
  if (!p.id?.startsWith("patex-el-")) continue;
  if (p.id === "patex-el-1012" || p.id === "patex-el-1018") continue;
  if (!p.image?.includes("/thumbs/")) continue;
  p.image = p.image.replace("/thumbs/", "/");
  eleganceUpdated++;
}
const elegCat = catalogsData.catalogs.find((c) => c.id === "patex-elegance");
if (elegCat) {
  for (const sw of elegCat.swatches) {
    const code = String(sw.sheetCode || sw.id || "").replace(/^EL-/i, "");
    if (code === "1012" || code === "1018") continue;
    if (sw.imageUrl?.includes("/thumbs/")) {
      sw.imageUrl = sw.imageUrl.replace("/thumbs/", "/");
    }
  }
}

async function writeJsonRetry(filePath, data, attempts = 8) {
  const body = JSON.stringify(data, null, 2) + "\n";
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await writeFile(filePath, body);
      return;
    } catch (e) {
      lastErr = e;
      await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

await writeJsonRetry(SCRAPED_OUT, {
  scrapedAt: new Date().toISOString(),
  category: "patex-lamination",
  count: rows.length,
  withImages: rows.length,
  products: rows.sort((a, b) =>
    String(a.sheetCode).localeCompare(String(b.sheetCode), undefined, {
      numeric: true,
    })
  ),
});

await writeJsonRetry(CATALOGS_PATH, catalogsData);
await writeJsonRetry(PRODUCTS_PATH, productsData);
const stillThumbs = productsData.products.filter(
  (p) =>
    p.brandName === "Patex" &&
    p.materialCategory === "Patex Lamination" &&
    p.image?.includes("/thumbs/")
).length;
const onFull = productsData.products.filter(
  (p) =>
    p.brandName === "Patex" &&
    p.materialCategory === "Patex Lamination" &&
    p.image &&
    !p.image.includes("/thumbs/")
).length;

console.log(`\nDone — ${done} downloaded, ${skipped} cached HQ, ${errors.length} errors`);
console.log(`Lamination products updated: ${productsUpdated}, swatches: ${swatchesUpdated}`);
console.log(`Elegance shop cards flipped to full: ${eleganceUpdated}`);
console.log(`Patex Lamination on full: ${onFull}, still on thumbs: ${stillThumbs}`);
if (errors.length) console.log("Errors:\n" + errors.slice(0, 25).join("\n"));
console.log(
  "\nNext: node scripts/upload-r2.mjs --prefix=patex  then  npm run seed-mongo"
);
