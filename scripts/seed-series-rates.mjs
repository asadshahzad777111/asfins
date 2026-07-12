/**
 * Seed series rates, stock, substrate, finishHint on catalogs + products.
 * Run: node scripts/seed-series-rates.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const DEFAULT_STOCK = 48;
const DEFAULT_LOW = 10;
const SYNC_STOCK = 18;

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function stockFor(id, series) {
  const base = /syncron/i.test(series) ? SYNC_STOCK : DEFAULT_STOCK;
  const jitter = hashCode(id) % 17;
  return Math.max(4, base - (jitter % 9) + (jitter % 5));
}

function parseSeriesFromDescription(description) {
  if (!description) return undefined;
  const m = description.match(/A\s+(.+?)\s+product\b/i);
  return m?.[1]?.trim();
}

function seriesForProduct(p) {
  if (p.materialCategory) return p.materialCategory;
  const fromDesc = parseSeriesFromDescription(p.description);
  if (fromDesc) return fromDesc;
  const brand = (p.brandName ?? "").toLowerCase();
  if (brand.includes("elegance")) return "Patex Elegance";
  if (brand.includes("patex")) return "Patex Lamination";
  return undefined;
}

function seriesForSwatch(sw, catalog) {
  if (sw.materialCategory) return sw.materialCategory;
  const fromDesc = parseSeriesFromDescription(sw.description);
  if (fromDesc) return fromDesc;
  const id = (catalog.id ?? "").toLowerCase();
  const name = (catalog.companyName ?? "").toLowerCase();
  if (id.includes("elegance") || name.includes("elegance")) return "Patex Elegance";
  if (id.includes("patex") || name.includes("patex")) return "Patex Lamination";
  return undefined;
}

function resolveRate(series, substrate) {
  const text = (series ?? "").trim();
  if (/uv\s*lux/i.test(text)) return 9000;
  if (/lamination\s*series/i.test(text)) {
    return substrate === "chipboard" ? 3400 : 5000;
  }
  if (/high\s*gloss\s*elite/i.test(text)) return 7500;
  if (/textured\s*laminat/i.test(text)) return 9000;
  if (/syncron\s*line/i.test(text)) return 12000;
  if (/patex\s*elegance/i.test(text)) return 8000;
  if (/patex/i.test(text) && substrate === "mdf") return 7000;
  if (/patex\s*lamination/i.test(text)) return 6000;
  if (/patex/i.test(text)) return 6000;
  return 0;
}

function finishHintId(series) {
  const text = (series ?? "").toLowerCase();
  if (/syncron|premium/.test(text)) return "syncron-premium";
  if (/\buv\b|uv\s*lux/.test(text)) return "uv-gloss";
  if (/high\s*gloss\s*elite|high\s*gloss/.test(text)) return "high-gloss-elite";
  if (/textured/.test(text)) return "textured";
  if (/lamination|patex/.test(text)) return "lamination";
  return undefined;
}

function substrateFor(series, brand) {
  if (/lamination\s*series/i.test(series ?? "")) return "mdf";
  if (/patex\s*elegance/i.test(series ?? "") || /elegance/i.test(brand ?? "")) return "mdf";
  return null;
}

const catalogsPath = resolve(root, "data/catalogs.json");
const productsPath = resolve(root, "data/products.json");

const catalogsDoc = JSON.parse(readFileSync(catalogsPath, "utf8"));
const productsDoc = JSON.parse(readFileSync(productsPath, "utf8"));

let swatchUpdates = 0;
for (const catalog of catalogsDoc.catalogs ?? []) {
  for (const sw of catalog.swatches ?? []) {
    const series = seriesForSwatch(sw, catalog);
    if (!series && catalog.id !== "zrk-group" && !/patex/i.test(catalog.id)) continue;

    const substrate =
      sw.substrate === "mdf" || sw.substrate === "chipboard"
        ? sw.substrate
        : substrateFor(series, catalog.companyName);

    const rate = resolveRate(series, substrate);
    if (rate > 0) {
      sw.pricePKR = rate;
      swatchUpdates++;
    }
    if (substrate) sw.substrate = substrate;
    else if (sw.substrate === undefined) sw.substrate = null;

    sw.stock = typeof sw.stock === "number" ? sw.stock : stockFor(sw.id, series ?? "");
    sw.lowStockAt =
      typeof sw.lowStockAt === "number" ? sw.lowStockAt : DEFAULT_LOW;

    const hint = finishHintId(series);
    if (hint) sw.finishHint = hint;
    if (!sw.materialCategory && series) sw.materialCategory = series;
  }
}

let productUpdates = 0;
for (const p of productsDoc.products ?? []) {
  const series = seriesForProduct(p);
  if (!series && !/zrk|patex/i.test(p.brandName ?? p.id ?? "")) continue;

  if (!p.materialCategory && series) p.materialCategory = series;

  const substrate =
    p.substrate === "mdf" || p.substrate === "chipboard"
      ? p.substrate
      : substrateFor(series, p.brandName);

  const rate = resolveRate(series, substrate);
  if (rate > 0) {
    p.pricePKR = rate;
    productUpdates++;
  }
  if (substrate) p.substrate = substrate;
  else if (p.substrate === undefined) p.substrate = null;

  p.stock = typeof p.stock === "number" ? p.stock : stockFor(p.id, series ?? "");
  p.lowStockAt = typeof p.lowStockAt === "number" ? p.lowStockAt : DEFAULT_LOW;

  const hint = finishHintId(series);
  if (hint) p.finishHint = hint;
}

writeFileSync(catalogsPath, JSON.stringify(catalogsDoc, null, 2) + "\n");
writeFileSync(productsPath, JSON.stringify(productsDoc, null, 2) + "\n");

console.log(
  `Seeded rates/stock: ${swatchUpdates} swatches, ${productUpdates} products`
);
