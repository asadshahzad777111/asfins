/**
 * Extract product swatches from Patex Elegance brochure PDF
 * and import as catalog `patex-elegance`.
 *
 * Usage: node scripts/import-patex-elegance-pdf.mjs
 */
import { createCanvas } from "canvas";
import { readFile, writeFile, mkdir, access, unlink, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import sharp from "sharp";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(ROOT, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;
const PDF_PATH =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || "", "Downloads", "Elegance Broucher 2026.pdf");
const WORK = path.join(ROOT, "data/patex-elegance-work");
const OUT_DIR = path.join(ROOT, "public/catalog-textures/patex-elegance");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");
const CATALOGS = path.join(ROOT, "data/catalogs.json");
const PRODUCTS = path.join(ROOT, "data/products.json");
const CATALOG_ID = "patex-elegance";
const PUBLIC_R2 =
  process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ||
  "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev";

function fallbackHex(name) {
  const c = (name || "").toLowerCase();
  const map = {
    white: "#F5F0E8",
    cream: "#F0E6D8",
    black: "#2A2A2A",
    grey: "#9A9A9A",
    gray: "#9A9A9A",
    brown: "#6B3A2A",
    oak: "#C4A574",
    walnut: "#5C4033",
    marble: "#E8E4DF",
    gold: "#C9A84C",
    blue: "#3A4A6B",
    green: "#4A6B4A",
    red: "#8B2E2E",
  };
  for (const [k, v] of Object.entries(map)) if (c.includes(k)) return v;
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

async function extractEmbeddedImages(pdf) {
  const images = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const ops = await page.getOperatorList();
    const { fnArray, argsArray } = ops;
    const seen = new Set();

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      // paintImageXObject / paintInlineImageXObject / paintImageMaskXObject
      if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintJpegXObject) continue;
      const name = argsArray[i][0];
      if (seen.has(name)) continue;
      seen.add(name);

      let img;
      try {
        img = page.objs.get(name);
      } catch {
        continue;
      }
      if (!img) continue;

      // Resolve promise-like objs
      if (typeof img.then === "function") img = await img;
      if (!img?.width || !img?.height || !img?.data) continue;

      const w = img.width;
      const h = img.height;
      const area = w * h;
      // Drop logos/icons (tiny) and full-bleed page photos (huge / extreme aspect)
      if (area < 80 * 80) continue;
      if (area > 2200 * 2200) continue;
      const ratio = w / h;
      if (ratio < 0.45 || ratio > 2.2) continue;

      images.push({
        page: pageNum,
        name,
        width: w,
        height: h,
        kind: img.kind,
        data: img.data,
      });
    }
  }
  return images;
}

async function imageDataToPngBuffer(img) {
  const { width, height, data, kind } = img;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);

  // pdfjs kinds: GRAYSCALE_1BPP=1, RGB_24BPP=2, RGBA_32BPP=3
  if (kind === 3 || data.length === width * height * 4) {
    imageData.data.set(data);
  } else if (kind === 2 || data.length === width * height * 3) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      imageData.data[j] = data[i];
      imageData.data[j + 1] = data[i + 1];
      imageData.data[j + 2] = data[i + 2];
      imageData.data[j + 3] = 255;
    }
  } else if (data.length === width * height) {
    for (let i = 0, j = 0; i < data.length; i++, j += 4) {
      const v = data[i];
      imageData.data[j] = v;
      imageData.data[j + 1] = v;
      imageData.data[j + 2] = v;
      imageData.data[j + 3] = 255;
    }
  } else {
    // Unknown — try as RGB
    const n = Math.min(data.length, width * height * 3);
    for (let i = 0, j = 0; i < n; i += 3, j += 4) {
      imageData.data[j] = data[i] ?? 0;
      imageData.data[j + 1] = data[i + 1] ?? 0;
      imageData.data[j + 2] = data[i + 2] ?? 0;
      imageData.data[j + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer("image/png");
}

/** Also pull text near images for codes like EL-1201 / PE-1001 */
async function extractPageTexts(pdf) {
  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((it) => it.str).join(" ");
    const codes = [
      ...new Set(
        [...text.matchAll(/\b(?:EL|PE|PK|EG|ELE)-?\s*(\d{3,5})\b/gi)].map(
          (m) => `EL-${m[1]}`
        )
      ),
    ];
    const names = content.items
      .map((it) => it.str.trim())
      .filter((s) => s.length > 2 && /[A-Za-z]/.test(s) && !/^\d+$/.test(s));
    pages.push({ pageNum, text, codes, names });
  }
  return pages;
}

console.log("PDF:", PDF_PATH);
if (!(await exists(PDF_PATH))) {
  console.error("PDF not found");
  process.exit(1);
}

await mkdir(WORK, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });
await mkdir(THUMB_DIR, { recursive: true });

const data = new Uint8Array(await readFile(PDF_PATH));
const pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
console.log("Pages:", pdf.numPages);

const pageTexts = await extractPageTexts(pdf);
console.log(
  "Sample codes:",
  pageTexts.flatMap((p) => p.codes).slice(0, 20)
);

const embedded = await extractEmbeddedImages(pdf);
console.log("Candidate embedded images:", embedded.length);

// Deduplicate by size+hash of first 200 bytes
const unique = [];
const sigs = new Set();
for (const img of embedded) {
  const head = Buffer.from(img.data.slice(0, 200)).toString("base64");
  const sig = `${img.width}x${img.height}:${head}`;
  if (sigs.has(sig)) continue;
  sigs.add(sig);
  unique.push(img);
}
console.log("Unique after dedupe:", unique.length);

// Prefer square-ish product tiles (0.7–1.4 ratio), mid size
const scored = unique
  .map((img) => {
    const ratio = img.width / img.height;
    const squareScore = 1 - Math.min(Math.abs(1 - ratio), 1);
    const sizeScore = Math.min(img.width, img.height) / 800;
    return { img, score: squareScore * 2 + sizeScore };
  })
  .sort((a, b) => b.score - a.score);

const kept = scored
  .filter((s) => {
    const r = s.img.width / s.img.height;
    return r >= 0.65 && r <= 1.55 && Math.min(s.img.width, s.img.height) >= 120;
  })
  .map((s) => s.img);

console.log("Kept product-like tiles:", kept.length);

// Save work PNGs for review, convert to webp
const rows = [];
let idx = 0;
for (const img of kept) {
  idx++;
  const code = `EL-${String(1000 + idx).padStart(4, "0")}`;
  // Prefer real code from same page if available
  const pageInfo = pageTexts.find((p) => p.pageNum === img.page);
  const pageCode = pageInfo?.codes?.[0];
  const sheetCode = pageCode && !rows.some((r) => r.sheetCode === pageCode)
    ? pageCode
    : code;

  // Try name from page text (skip short/generic)
  let name = sheetCode;
  if (pageInfo?.names?.length) {
    const candidate = pageInfo.names.find(
      (n) =>
        n.length >= 4 &&
        n.length < 40 &&
        !/elegance|patex|brochure|page|www\.|http/i.test(n)
    );
    if (candidate) name = `${sheetCode} ${candidate}`;
  }

  const fileKey = sheetCode.replace(/^EL-/i, "").replace(/[^A-Za-z0-9_-]/g, "");
  try {
    const png = await imageDataToPngBuffer(img);
    const workPng = path.join(WORK, `${fileKey}.png`);
    await writeFile(workPng, png);

    const fullDisk = path.join(OUT_DIR, `${fileKey}.webp`);
    const thumbDisk = path.join(THUMB_DIR, `${fileKey}.webp`);
    await sharp(png)
      .resize(768, 768, { fit: "cover" })
      .webp({ quality: 84 })
      .toFile(fullDisk);
    await sharp(png)
      .resize(320, 320, { fit: "cover" })
      .webp({ quality: 78 })
      .toFile(thumbDisk);

    rows.push({
      sheetCode,
      name,
      fileKey,
      page: img.page,
      width: img.width,
      height: img.height,
    });
  } catch (e) {
    console.warn("Skip", sheetCode, e.message);
  }
}

console.log("Saved textures:", rows.length);

// Build catalog
const catalogsData = JSON.parse(await readFile(CATALOGS, "utf8"));
const productsData = JSON.parse(await readFile(PRODUCTS, "utf8"));

let catalog = catalogsData.catalogs.find((c) => c.id === CATALOG_ID);
if (!catalog) {
  catalog = {
    id: CATALOG_ID,
    companyName: "Patex Elegance",
    global: true,
    createdAt: new Date().toISOString(),
    swatches: [],
  };
  catalogsData.catalogs.push(catalog);
} else {
  catalog.companyName = "Patex Elegance";
  catalog.swatches = [];
}

const usedCodes = new Set();
for (const row of rows) {
  let sheetCode = row.sheetCode;
  if (usedCodes.has(sheetCode)) sheetCode = `EL-${row.fileKey}`;
  usedCodes.add(sheetCode);

  const id = `patex-el-${row.fileKey}`;
  const imageUrl = `${PUBLIC_R2}/catalog-textures/patex-elegance/${row.fileKey}.webp`;
  const thumbUrl = `${PUBLIC_R2}/catalog-textures/patex-elegance/thumbs/${row.fileKey}.webp`;

  catalog.swatches.push({
    id,
    name: row.name,
    hex: fallbackHex(row.name),
    sheetCode,
    pricePKR: 0,
    palette: "wood",
    imageUrl,
    thumbUrl,
    materialCategory: "Patex Elegance",
    dimensions: "2440*1220",
    thickness: "16mm",
    description: `${row.name} — Patex Elegance collection.`,
    idealApplications: "Kitchen cabinets, wardrobes",
  });

  const product = {
    id,
    name: row.name,
    pricePKR: 0,
    image: thumbUrl,
    category: "wood-laminate",
    description: `${row.name} — Patex Elegance collection.`,
    active: true,
    createdAt: new Date().toISOString(),
    productCode: sheetCode,
    dimensions: "2440*1220",
    thickness: "16mm",
    idealApplications: "Kitchen Cabinets",
    brandName: "Patex Elegance",
  };
  const pIdx = productsData.products.findIndex((p) => p.id === id);
  if (pIdx >= 0) productsData.products[pIdx] = { ...productsData.products[pIdx], ...product, createdAt: productsData.products[pIdx].createdAt };
  else productsData.products.push(product);
}

await writeFile(CATALOGS, JSON.stringify(catalogsData, null, 2) + "\n");
await writeFile(PRODUCTS, JSON.stringify(productsData, null, 2) + "\n");
await writeFile(
  path.join(ROOT, "data/patex-elegance-scraped.json"),
  JSON.stringify({ count: rows.length, products: rows }, null, 2) + "\n"
);

// Clean work PNGs (extra pics) — keep only webp in public
const workFiles = await readdir(WORK);
for (const f of workFiles) {
  await unlink(path.join(WORK, f)).catch(() => {});
}

console.log(`\nCatalog ${CATALOG_ID}: ${catalog.swatches.length} swatches`);
console.log("Done. Next: upload-r2 for patex-elegance folder + brands logo + push");
