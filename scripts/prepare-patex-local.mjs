/**
 * Import Patex scraped products → catalogs + products, mirror textures locally.
 *
 * Usage: node scripts/prepare-patex-local.mjs
 * Optional: --limit=20
 */
import sharp from "sharp";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public/catalog-textures/patex");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const SCRAPED = path.join(ROOT, "data/patex-lamination-scraped.json");
const CATALOGS = path.join(ROOT, "data/catalogs.json");
const PRODUCTS = path.join(ROOT, "data/products.json");
const PATEX_ID = "patex";
const CONCURRENCY = 8;
const UA = "Mozilla/5.0 (compatible; ASFins-Patex-Import/1.0; +https://asfins.com)";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : 0;

function fallbackHex(name) {
  const c = (name || "").toLowerCase();
  const map = {
    white: "#F5F0E8",
    cream: "#F0E6D8",
    ivory: "#F5F0E8",
    black: "#2A2A2A",
    nero: "#1A1A1A",
    grey: "#9A9A9A",
    gray: "#9A9A9A",
    graphite: "#4A4A4A",
    brown: "#6B3A2A",
    oak: "#C4A574",
    walnut: "#5C4033",
    teak: "#8B6914",
    pine: "#D4C4A0",
    maple: "#D4B896",
    cherry: "#8B3A2A",
    beech: "#D2B48C",
    bamboo: "#C8B56A",
    blue: "#3A4A6B",
    green: "#4A6B4A",
    red: "#8B2E2E",
    pink: "#D4A0A8",
    gold: "#C9A84C",
    yellow: "#D4C44A",
    orange: "#E86A2A",
    purple: "#5A3A6B",
    marble: "#E8E4DF",
    onyx: "#2A2A2A",
  };
  for (const [k, v] of Object.entries(map)) {
    if (c.includes(k)) return v;
  }
  return "#5C5C5C";
}

function safeCode(sheetCode) {
  return String(sheetCode || "unknown")
    .replace(/^PK-/i, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-");
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function proxyFull(remoteUrl) {
  // Hostinger CDN blocks datacenter IPs; wsrv.nl can still fetch origin images.
  // No width cap — keep near-original fidelity.
  return `https://wsrv.nl/?url=${encodeURIComponent(remoteUrl)}&n=-1&output=jpg&q=95`;
}

async function downloadOne(code, remoteUrl) {
  const thumbDisk = path.join(THUMB_DIR, `${code}.webp`);
  const fullDisk = path.join(OUT_DIR, `${code}.webp`);
  const thumbUrl = `/catalog-textures/patex/thumbs/${code}.webp`;
  const imageUrl = `/catalog-textures/patex/${code}.webp`;

  if ((await exists(thumbDisk)) && (await exists(fullDisk))) {
    return { code, thumbUrl, imageUrl, skipped: true };
  }

  let res = await fetch(remoteUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    res = await fetch(proxyFull(remoteUrl), { headers: { "User-Agent": UA } });
  }
  if (!res.ok) {
    const wb = `https://web.archive.org/web/2id_/${remoteUrl}`;
    res = await fetch(wb, { headers: { "User-Agent": UA } });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  await sharp(buf)
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92 })
    .toFile(fullDisk);

  await sharp(buf)
    .resize(1024, 1024, { fit: "cover" })
    .webp({ quality: 90 })
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

const scraped = JSON.parse(await readFile(SCRAPED, "utf8"));
let products = scraped.products ?? scraped;
if (!Array.isArray(products)) {
  console.error("Invalid scraped JSON");
  process.exit(1);
}
products = products.filter((p) => p.imageUrl);
if (LIMIT > 0) products = products.slice(0, LIMIT);

await mkdir(OUT_DIR, { recursive: true });
await mkdir(THUMB_DIR, { recursive: true });

console.log(`Downloading ${products.length} Patex textures...\n`);
let done = 0;
let skipped = 0;
const errors = [];

const results = await mapPool(
  products,
  async (p) => {
    const code = safeCode(p.sheetCode);
    try {
      const r = await downloadOne(code, p.imageUrl);
      if (r.skipped) skipped++;
      else done++;
      if ((done + skipped) % 25 === 0) {
        console.log(`Progress ${done + skipped}/${products.length}`);
      }
      return { ...r, sheetCode: p.sheetCode };
    } catch (e) {
      errors.push(`${p.sheetCode}: ${e.message}`);
      return null;
    }
  },
  CONCURRENCY
);

const byCode = new Map(
  results.filter(Boolean).map((r) => [String(r.sheetCode), r])
);

const catalogsData = JSON.parse(await readFile(CATALOGS, "utf8"));
const productsData = JSON.parse(await readFile(PRODUCTS, "utf8"));
let catalog = catalogsData.catalogs.find((c) => c.id === PATEX_ID);
if (!catalog) {
  catalog = {
    id: PATEX_ID,
    companyName: "Patex",
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
  const m = byCode.get(String(row.sheetCode));
  const code = safeCode(row.sheetCode);
  const thumbUrl = m?.thumbUrl ?? row.imageUrl;
  const imageUrl = m?.imageUrl ?? row.imageUrl;
  const id = `patex-${code}`;
  const swatch = {
    id,
    name: row.name,
    hex: fallbackHex(row.name),
    sheetCode: String(row.sheetCode),
    pricePKR: row.pricePKR ?? 0,
    palette: "wood",
    imageUrl,
    thumbUrl,
    materialCategory: row.materialCategory ?? "Patex Lamination",
    surfaceFinish: row.surfaceFinish,
    colorDescription: row.colorDescription,
    dimensions: row.dimensions ?? "2440*1220",
    thickness: row.thickness ?? "16mm",
    description:
      row.description ??
      `${row.name} — Patex lamination sheet.`,
    idealApplications: "Kitchen cabinets, wardrobes",
  };

  if (swatchMap.has(String(row.sheetCode))) {
    Object.assign(swatchMap.get(String(row.sheetCode)), swatch);
    updated++;
  } else {
    catalog.swatches.push(swatch);
    swatchMap.set(String(row.sheetCode), swatch);
    added++;
  }

  const product = {
    id,
    name: row.name,
    pricePKR: row.pricePKR ?? 0,
    image: imageUrl,
    category: "wood-laminate",
    description: row.description ?? `${row.name} — Patex.`,
    active: true,
    createdAt: new Date().toISOString(),
    productCode: String(row.sheetCode),
    surfaceFinish: row.surfaceFinish,
    colorDescription: row.colorDescription,
    dimensions: row.dimensions ?? "2440*1220",
    thickness: row.thickness ?? "16mm",
    idealApplications: "Kitchen Cabinets",
    brandName: "Patex",
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

await writeFile(CATALOGS, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS, JSON.stringify(productsData, null, 2) + "\n");

console.log(
  `\nCatalog: +${added} / ~${updated} | Images: ${done} new, ${skipped} cached`
);
if (errors.length) {
  console.log(`Errors (${errors.length}):`, errors.slice(0, 12).join("; "));
}
console.log("Done — next: npm run upload-r2 (optional) then git push.");
