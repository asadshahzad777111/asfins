/**
 * Bulk import ZRK items from JSON into data/catalogs.json + data/products.json
 * Usage: node scripts/import-zrk-batch.mjs data/zrk-import.json
 */
import { readFile, writeFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CATALOGS_PATH = path.join(ROOT, "data/catalogs.json");
const PRODUCTS_PATH = path.join(ROOT, "data/products.json");
const ZRK_ID = "zrk-group";
const DEFAULT_DIMENSIONS = "2440*1220";
const DEFAULT_THICKNESS = "16mm";

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
  };
  for (const [k, v] of Object.entries(map)) {
    if (c.includes(k)) return v;
  }
  return "#5C5C5C";
}

function rowToSwatch(row) {
  const id = `zrk-${row.sheetCode}`;
  const color = row.colorDescription;
  const cat = row.materialCategory ?? "Textured Laminates";
  return {
    id,
    name: row.name,
    hex: fallbackHex(color),
    sheetCode: String(row.sheetCode),
    pricePKR: row.pricePKR ?? 0,
    palette: "wood",
    imageUrl: row.imageUrl,
    thumbUrl: row.thumbUrl,
    materialCategory: cat,
    surfaceFinish: row.surfaceFinish,
    colorDescription: color,
    dimensions: DEFAULT_DIMENSIONS,
    thickness: DEFAULT_THICKNESS,
    description:
      row.surfaceFinish && color
        ? `A ${cat} product with a ${row.surfaceFinish} surface, featuring a ${color} color tone.`
        : undefined,
    idealApplications: "Kitchen cabinets, wardrobes",
  };
}

function rowToProduct(row, swatch) {
  return {
    id: swatch.id,
    name: row.name,
    pricePKR: row.pricePKR ?? 0,
    image: row.thumbUrl ?? row.imageUrl,
    category: (row.materialCategory ?? "").toLowerCase().includes("marble")
      ? "marble"
      : "wood-laminate",
    description: swatch.description ?? `${row.name} — ZRK Group laminate.`,
    active: true,
    createdAt: new Date().toISOString(),
    productCode: String(row.sheetCode),
    surfaceFinish: row.surfaceFinish,
    colorDescription: row.colorDescription,
    dimensions: DEFAULT_DIMENSIONS,
    thickness: DEFAULT_THICKNESS,
    idealApplications: "Kitchen Cabinets",
    brandName: "ZRK Group",
  };
}

const fileArg = process.argv[2] ?? path.join(ROOT, "data/zrk-import.json");
await access(fileArg).catch(() => {
  console.error(`Missing file: ${fileArg}`);
  console.error("Copy data/zrk-import.example.json → data/zrk-import.json");
  process.exit(1);
});

const parsed = JSON.parse(await readFile(fileArg, "utf-8"));
const rows = Array.isArray(parsed) ? parsed : parsed.products;
if (!Array.isArray(rows)) {
  console.error("JSON must be an array or { products: [...] }");
  process.exit(1);
}

const catalogsData = JSON.parse(await readFile(CATALOGS_PATH, "utf-8"));
const productsData = JSON.parse(await readFile(PRODUCTS_PATH, "utf-8"));
const catalog = catalogsData.catalogs.find((c) => c.id === ZRK_ID);
if (!catalog) {
  console.error("zrk-group catalog not found");
  process.exit(1);
}

let added = 0;
let updated = 0;

for (const row of rows) {
  const swatch = rowToSwatch(row);
  const product = rowToProduct(row, swatch);
  const sIdx = catalog.swatches.findIndex(
    (s) => s.id === swatch.id || s.sheetCode === swatch.sheetCode
  );
  if (sIdx >= 0) {
    catalog.swatches[sIdx] = { ...catalog.swatches[sIdx], ...swatch };
    updated++;
  } else {
    catalog.swatches.push(swatch);
    added++;
  }
  const pIdx = productsData.products.findIndex((p) => p.id === product.id);
  if (pIdx >= 0) {
    productsData.products[pIdx] = {
      ...productsData.products[pIdx],
      ...product,
      createdAt: productsData.products[pIdx].createdAt,
      pricePKR:
        row.pricePKR > 0 ? row.pricePKR : productsData.products[pIdx].pricePKR,
    };
  } else {
    productsData.products.push(product);
  }
}

await writeFile(CATALOGS_PATH, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS_PATH, JSON.stringify(productsData, null, 2) + "\n");
console.log(`OK — catalog: ${added} added, ${updated} updated (${rows.length} items)`);
