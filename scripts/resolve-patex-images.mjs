/**
 * Resolve Patex product image URLs by probing wp-content paths (images are not CDN-blocked).
 * Then write data/patex-lamination-scraped.json
 *
 * Usage: node scripts/resolve-patex-images.mjs
 */
import { readFile, writeFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "data/patex-raw");
const OUT = path.join(ROOT, "data/patex-lamination-scraped.json");
const UA = "Mozilla/5.0 (compatible; ASFins-Patex-Import/1.0; +https://asfins.com)";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractSheetCode(title, slug) {
  const t = title || "";
  const m =
    t.match(/\b(PK-?\d+[A-Za-z]?)\b/i) ||
    t.match(/\b(EP-?\d+)\b/i) ||
    slug.match(/\b(pk-?\d+[a-z]?)\b/i);
  if (m) {
    let c = m[1].toUpperCase().replace(/\s+/g, "");
    if (/^PK\d/.test(c)) c = c.replace(/^PK/, "PK-");
    if (/^EP\d/.test(c)) c = c.replace(/^EP/, "EP-");
    return c;
  }
  const num = t.match(/\b(\d{3,5}[A-Za-z]?)\b/) || slug.match(/(\d{3,5}[a-z]?)/i);
  return num ? `PK-${num[1].toUpperCase()}` : slug.toUpperCase();
}

function namePart(title, sheetCode) {
  return title
    .replace(new RegExp(`^${sheetCode}\\s*`, "i"), "")
    .replace(/^\d+\s*/, "")
    .trim()
    .replace(/[’']/g, "")
    .replace(/[()]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function candidates(sheetCode, title, slug) {
  const codeNum = sheetCode.replace(/^PK-/i, "");
  const np = namePart(title, sheetCode);
  const files = [
    `Pk-${codeNum}.jpg.jpg`,
    `PK-${codeNum}.jpg.jpg`,
    `PK-${codeNum}-${np}.jpg`,
    `PK-${codeNum}-${np}-1.jpg`,
    `PK-${codeNum}-${np}-2.jpg`,
    `${codeNum}-${np}.jpg`,
    `${codeNum}-${np}-Patex-Lamination-1-scaled.jpg`,
    `${codeNum}-${np}-Patex-Lamination-1.jpg`,
    `PK-${codeNum}-scaled.jpg`,
    `PK-${np}.jpg`,
  ];
  // Title-case variants already in np from dashes
  const folders = [
    "2026/07",
    "2025/02",
    "2025/01",
    "2024/10",
    "2024/07",
    "2024/06",
    "2024/01",
    "2023/12",
    "2023/10",
    "2021/04",
    "2020/06",
    "2020/05",
    "2019/04",
    "2019/07",
  ];
  const urls = [];
  for (const folder of folders) {
    for (const file of files) {
      urls.push(`https://patex.com.pk/wp-content/uploads/${folder}/${file}`);
    }
  }
  return urls;
}

async function urlExists(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Range: "bytes=0-1" },
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") || "";
    return (res.ok || res.status === 206) && /image\//i.test(ct);
  } catch {
    return false;
  }
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

// Load products from TSV
const tsvFiles = (await readdir(RAW))
  .filter((f) => f.startsWith("products-page-") && f.endsWith(".tsv"))
  .sort();
const products = [];
for (const f of tsvFiles) {
  const text = await readFile(path.join(RAW, f), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [id, slug, title, featured_media, link] = line.split("\t");
    if (!id) continue;
    products.push({
      id: Number(id),
      slug,
      title,
      featured_media: Number(featured_media),
      link,
    });
  }
}

// Optional known media map
let mediaMap = new Map();
try {
  const mediaFiles = (await readdir(RAW)).filter(
    (f) => f.startsWith("media-") && f.endsWith(".json")
  );
  for (const f of mediaFiles) {
    const arr = JSON.parse(await readFile(path.join(RAW, f), "utf8"));
    for (const m of arr) {
      if (m.id && m.source_url) mediaMap.set(m.id, m.source_url);
    }
  }
} catch {
  /* ignore */
}

console.log(`Resolving images for ${products.length} products (${mediaMap.size} known media)...\n`);

let found = 0;
let missing = 0;
const rows = await mapPool(
  products,
  async (p, i) => {
    const sheetCode = extractSheetCode(p.title, p.slug);
    const name = p.title.replace(/\.jpg$/i, "").trim();
    let imageUrl = mediaMap.get(p.featured_media) || "";
    if (!imageUrl) {
      for (const url of candidates(sheetCode, p.title, p.slug)) {
        if (await urlExists(url)) {
          imageUrl = url;
          break;
        }
        await sleep(15);
      }
    }
    if (imageUrl) found++;
    else missing++;
    if ((i + 1) % 20 === 0) {
      console.log(`Progress ${i + 1}/${products.length} (found ${found}, missing ${missing})`);
    }
    return {
      sheetCode,
      name,
      imageUrl,
      sourceUrl: p.link,
      pricePKR: 0,
      dimensions: "2440*1220",
      thickness: "16mm",
      materialCategory: "Patex Lamination",
      brandName: "Patex",
      slug: p.slug,
      featured_media: p.featured_media,
    };
  },
  8
);

const payload = {
  scrapedAt: new Date().toISOString(),
  category: "patex-lamination",
  categoryId: 109,
  count: rows.length,
  withImages: rows.filter((r) => r.imageUrl).length,
  products: rows.sort((a, b) => String(a.sheetCode).localeCompare(String(b.sheetCode), undefined, { numeric: true })),
};

await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(`\nDone: ${payload.withImages}/${payload.count} images → ${OUT}`);
const miss = rows.filter((r) => !r.imageUrl);
if (miss.length) {
  console.log("Missing samples:", miss.slice(0, 15).map((m) => m.sheetCode + " " + m.name).join(" | "));
}
