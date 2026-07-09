/**
 * Scrape all ZRK MDF products from zrkgroup.com listing + detail pages.
 *
 * Usage:
 *   node scripts/scrape-zrk-mdf.mjs              # scrape → data/zrk-mdf-scraped.json
 *   node scripts/scrape-zrk-mdf.mjs --import       # scrape + import into catalogs/products
 *   node scripts/scrape-zrk-mdf.mjs --pages-only   # only collect URLs (fast)
 */
import { readFile, writeFile, access } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_PATH = path.join(ROOT, "data/zrk-mdf-scraped.json");
const BASE = "https://zrkgroup.com";
const LIST_URL = `${BASE}/products?producttype=MDF`;
const CONCURRENCY = 8;
const DELAY_MS = 120;

const args = new Set(process.argv.slice(2));
const doImport = args.has("--import");
const pagesOnly = args.has("--pages-only");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "ArtisanInteriors-ZRK-Import/1.0",
          Accept: "text/html",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(500 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

function extractProductLinks(html) {
  return [...new Set([...html.matchAll(/href="(\/products\/\d+)"/g)].map((m) => m[1]))];
}

async function collectAllProductPaths() {
  const paths = new Set();
  let page = 1;
  let stable = 0;

  while (page <= 25 && stable < 2) {
    const url = `${LIST_URL}&page=${page}`;
    process.stdout.write(`Listing page ${page}... `);
    const html = await fetchText(url);
    const before = paths.size;
    for (const p of extractProductLinks(html)) paths.add(p);
    const added = paths.size - before;
    console.log(`+${added} (total ${paths.size})`);
    if (added === 0) stable++;
    else stable = 0;
    page++;
    await sleep(DELAY_MS);
  }

  return [...paths].sort((a, b) => {
    const na = Number(a.split("/").pop());
    const nb = Number(b.split("/").pop());
    return na - nb;
  });
}

function specValue(html, label) {
  const re = new RegExp(
    `${label}</span><span class="text-sm font-medium text-neutral-900">([^<]+)`
  );
  return html.match(re)?.[1]?.trim();
}

function parseProductPage(html, fallbackCode) {
  const code =
    html.match(
      /<p class="mb-4 text-sm tracking-wide text-neutral-400">(\d+)<\/p>/
    )?.[1] ?? fallbackCode;

  const name = html.match(/<h1[^>]*>([^<]+)/)?.[1]?.trim() ?? `ZRK ${code}`;

  const materialCategory =
    html.match(
      /tracking-widest text-neutral-500 uppercase">([^<]+)<\/span><h1/
    )?.[1]?.trim() ?? "Textured Laminates";

  const imgs = [
    ...new Set(
      [...html.matchAll(/_next\/image\?url=([^&"']+)/g)]
        .map((m) => decodeURIComponent(m[1]))
        .filter((u) => u.includes("strapi.zrkgroup.com/uploads"))
    ),
  ];
  const imageUrl =
    imgs.find((u) => u.includes(`/${code}_`) || u.includes(`/${code}.`)) ??
    imgs[0] ??
    "";

  const surfaceFinish = specValue(html, "Surface Finish");
  const colorDescription = specValue(html, "Color");
  const dimensions = specValue(html, "Dimensions") ?? "2440*1220";
  const thickness = specValue(html, "Thickness") ?? "16mm";

  const description = html.match(
    /<p class="mb-6 text-sm leading-relaxed text-neutral-600">([^<]+)/
  )?.[1]?.trim();

  return {
    sheetCode: code,
    name,
    imageUrl,
    surfaceFinish,
    colorDescription,
    materialCategory,
    dimensions,
    thickness,
    description,
    sourceUrl: `${BASE}/products/${code}`,
    pricePKR: 0,
  };
}

async function mapPool(items, fn, concurrency) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function scrapeDetails(paths) {
  const rows = [];
  const errors = [];

  await mapPool(
    paths,
    async (productPath, i) => {
      const code = productPath.split("/").pop();
      try {
        const html = await fetchText(`${BASE}${productPath}`);
        const row = parseProductPage(html, code);
        if (!row.imageUrl) {
          errors.push(`${code}: no image URL`);
        } else {
          rows.push(row);
        }
        if ((i + 1) % 25 === 0 || i === paths.length - 1) {
          console.log(`Details ${i + 1}/${paths.length} (${rows.length} ok)`);
        }
        await sleep(DELAY_MS);
      } catch (e) {
        errors.push(`${code}: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    CONCURRENCY
  );

  rows.sort((a, b) => Number(a.sheetCode) - Number(b.sheetCode));
  return { rows, errors };
}

async function runImport(rows) {
  const importPath = path.join(ROOT, "data/zrk-mdf-import-temp.json");
  await writeFile(importPath, JSON.stringify(rows, null, 2) + "\n");
  const { spawn } = await import("child_process");
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/import-zrk-batch.mjs", importPath], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`import exit ${code}`))));
  });
}

console.log("ZRK MDF scraper — zrkgroup.com\n");

const paths = await collectAllProductPaths();
console.log(`\nFound ${paths.length} unique MDF product URLs\n`);

if (pagesOnly) {
  await writeFile(OUT_PATH, JSON.stringify({ scrapedAt: new Date().toISOString(), count: paths.length, paths }, null, 2) + "\n");
  console.log(`Saved paths → ${OUT_PATH}`);
  process.exit(0);
}

const { rows, errors } = await scrapeDetails(paths);
const payload = {
  scrapedAt: new Date().toISOString(),
  productType: "MDF",
  count: rows.length,
  errors,
  products: rows,
};

await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
console.log(`\nSaved ${rows.length} products → ${OUT_PATH}`);
if (errors.length) console.log(`Errors (${errors.length}):`, errors.slice(0, 10).join("\n  "));

if (doImport) {
  console.log("\nImporting into data/catalogs.json + data/products.json...");
  await runImport(rows);
  console.log("Import complete.");
}
