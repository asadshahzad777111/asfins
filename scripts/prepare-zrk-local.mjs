/**
 * 1) Import scraped ZRK MDF products into catalogs + products
 * 2) Download each Strapi image → local webp thumb (320) + full (768)
 * 3) Point catalog/product URLs to local /catalog-textures/zrk/...
 *
 * Usage: node scripts/prepare-zrk-local.mjs
 * Optional: --limit=20  (test first)
 */
import sharp from "sharp";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/catalog-textures/zrk");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const SCRAPED = path.join(ROOT, "data/zrk-mdf-scraped.json");
const CATALOGS = path.join(ROOT, "data/catalogs.json");
const PRODUCTS = path.join(ROOT, "data/products.json");
const ZRK_ID = "zrk-group";
const CONCURRENCY = 8;

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 0;

function fallbackHex(color) {
  if (!color) return "#5C5C5C";
  const c = color.toLowerCase();
  const map = {
    orange: "#E86A2A",
    red: "#8B2E2E",
    brown: "#6B3A2A",
    white: "#F5F0E8",
    grey: "#9A9A9A",
    gray: "#9A9A9A",
    black: "#2A2A2A",
    green: "#4A6B4A",
    blue: "#3A4A6B",
    beige: "#D4C4A8",
  };
  for (const [k, v] of Object.entries(map)) {
    if (c.includes(k)) return v;
  }
  return "#5C5C5C";
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadOne(code, remoteUrl) {
  const thumbDisk = path.join(THUMB_DIR, `${code}.webp`);
  const fullDisk = path.join(OUT_DIR, `${code}.webp`);
  const thumbUrl = `/catalog-textures/zrk/thumbs/${code}.webp`;
  const imageUrl = `/catalog-textures/zrk/${code}.webp`;

  if ((await exists(thumbDisk)) && (await exists(fullDisk))) {
    return { code, thumbUrl, imageUrl, skipped: true };
  }

  const res = await fetch(remoteUrl, {
    headers: { "User-Agent": "ASFins-ZRK-Mirror/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  await sharp(buf)
    .resize(768, 768, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(fullDisk);

  await sharp(buf)
    .resize(320, 320, { fit: "cover" })
    .webp({ quality: 75 })
    .toFile(thumbDisk);

  return { code, thumbUrl, imageUrl, skipped: false };
}

async function mapPool(items, fn, n) {
  let idx = 0;
  const out = [];
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

/** Solid colour swatches for catalogs without texture images */
async function generateHexSwatches(catalogsData) {
  const hexDir = path.join(ROOT, "public/catalog-textures/hex");
  await mkdir(hexDir, { recursive: true });
  let n = 0;
  for (const cat of catalogsData.catalogs) {
    for (const sw of cat.swatches) {
      if (sw.imageUrl || sw.thumbUrl) continue;
      if (!sw.hex) continue;
      const file = `${sw.id}.webp`;
      const disk = path.join(hexDir, file);
      const url = `/catalog-textures/hex/${file}`;
      if (!(await exists(disk))) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="${sw.hex}"/></svg>`;
        await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile(disk);
      }
      sw.imageUrl = url;
      sw.thumbUrl = url;
      n++;
    }
  }
  console.log(`Hex swatches ready: ${n}`);
}

const scraped = JSON.parse(await readFile(SCRAPED, "utf8"));
let products = scraped.products ?? scraped;
if (!Array.isArray(products)) {
  console.error("Invalid scraped JSON");
  process.exit(1);
}
if (LIMIT > 0) products = products.slice(0, LIMIT);

await mkdir(OUT_DIR, { recursive: true });
await mkdir(THUMB_DIR, { recursive: true });

console.log(`Downloading ${products.length} ZRK textures...\n`);
let done = 0;
let skipped = 0;
const errors = [];

const results = await mapPool(
  products,
  async (p) => {
    try {
      const r = await downloadOne(p.sheetCode, p.imageUrl);
      if (r.skipped) skipped++;
      else done++;
      if ((done + skipped) % 25 === 0) {
        console.log(`Progress ${done + skipped}/${products.length}`);
      }
      return r;
    } catch (e) {
      errors.push(`${p.sheetCode}: ${e.message}`);
      return null;
    }
  },
  CONCURRENCY
);

const byCode = new Map(results.filter(Boolean).map((r) => [r.code, r]));

const catalogsData = JSON.parse(await readFile(CATALOGS, "utf8"));
const productsData = JSON.parse(await readFile(PRODUCTS, "utf8"));
let catalog = catalogsData.catalogs.find((c) => c.id === ZRK_ID);
if (!catalog) {
  catalog = {
    id: ZRK_ID,
    companyName: "ZRK Group",
    global: true,
    createdAt: new Date().toISOString(),
    swatches: [],
  };
  catalogsData.catalogs.push(catalog);
}

const swatchMap = new Map(catalog.swatches.map((s) => [s.sheetCode, s]));
let added = 0;
let updated = 0;

for (const row of products) {
  const m = byCode.get(row.sheetCode);
  const thumbUrl = m?.thumbUrl ?? row.imageUrl;
  const imageUrl = m?.imageUrl ?? row.imageUrl;
  const id = `zrk-${row.sheetCode}`;
  const swatch = {
    id,
    name: row.name,
    hex: fallbackHex(row.colorDescription),
    sheetCode: String(row.sheetCode),
    pricePKR: row.pricePKR ?? 0,
    palette: "wood",
    imageUrl,
    thumbUrl,
    materialCategory: row.materialCategory ?? "Textured Laminates",
    surfaceFinish: row.surfaceFinish,
    colorDescription: row.colorDescription,
    dimensions: row.dimensions ?? "2440*1220",
    thickness: row.thickness ?? "16mm",
    description: row.description,
    idealApplications: "Kitchen cabinets, wardrobes",
  };

  if (swatchMap.has(row.sheetCode)) {
    Object.assign(swatchMap.get(row.sheetCode), swatch);
    updated++;
  } else {
    catalog.swatches.push(swatch);
    swatchMap.set(row.sheetCode, swatch);
    added++;
  }

  const product = {
    id,
    name: row.name,
    pricePKR: row.pricePKR ?? 0,
    image: thumbUrl,
    category: "wood-laminate",
    description: row.description ?? `${row.name} — ZRK Group.`,
    active: true,
    createdAt: new Date().toISOString(),
    productCode: String(row.sheetCode),
    surfaceFinish: row.surfaceFinish,
    colorDescription: row.colorDescription,
    dimensions: row.dimensions ?? "2440*1220",
    thickness: row.thickness ?? "16mm",
    idealApplications: "Kitchen Cabinets",
    brandName: "ZRK Group",
  };
  const pIdx = productsData.products.findIndex((x) => x.id === id);
  if (pIdx >= 0) {
    productsData.products[pIdx] = {
      ...productsData.products[pIdx],
      ...product,
      createdAt: productsData.products[pIdx].createdAt,
    };
  } else {
    productsData.products.push(product);
  }
}

await generateHexSwatches(catalogsData);

await writeFile(CATALOGS, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS, JSON.stringify(productsData, null, 2) + "\n");

console.log(`\nCatalog: +${added} / ~${updated} | Images: ${done} new, ${skipped} cached`);
if (errors.length) console.log(`Errors (${errors.length}):`, errors.slice(0, 8).join("; "));
console.log("Done — local textures ready. Next: npm run upload-r2 (optional) then git push.");
