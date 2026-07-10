/**
 * Scrape Patex Lamination (product_cat=109) via WP REST.
 * Hostinger CDN blocks datacenter IPs for HTML/API — use --from-files
 * after saving API JSON via an unblocked client (Cursor WebFetch).
 *
 * Usage:
 *   node scripts/scrape-patex-lamination.mjs --from-files
 *   node scripts/scrape-patex-lamination.mjs --resolve-images
 *
 * Expects:
 *   data/patex-raw/products-page-1.json … page-3.json  (wp/v2/product arrays)
 *   data/patex-raw/media-*.json (optional wp/v2/media arrays with source_url)
 */
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "data/patex-raw");
const OUT = path.join(ROOT, "data/patex-lamination-scraped.json");
const UA = "Mozilla/5.0 (compatible; ASFins-Patex-Import/1.0; +https://asfins.com)";
const DELAY_MS = 80;

const args = new Set(process.argv.slice(2));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractSheetCode(title, slug) {
  const t = decodeHtml(title);
  const m =
    t.match(/\b(PK[-\s]?[\d]+[A-Za-z]?)\b/i) ||
    t.match(/\b(EP[-\s]?[\d]+)\b/i) ||
    slug.match(/\b(pk[-\s]?[\d]+[a-z]?)\b/i);
  if (!m) {
    const num = t.match(/\b(\d{3,5})\b/);
    return num ? `PK-${num[1]}` : slug.toUpperCase();
  }
  return m[1].toUpperCase().replace(/\s+/g, "-").replace(/^PK(?=\d)/, "PK-");
}

function displayName(title) {
  return decodeHtml(title).replace(/\.jpg$/i, "").trim();
}

async function loadJsonFiles(prefix) {
  const files = (await readdir(RAW))
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  const rows = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(path.join(RAW, f), "utf8"));
    if (Array.isArray(data)) rows.push(...data);
    else if (Array.isArray(data.products)) rows.push(...data.products);
  }
  return rows;
}

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    if (res.ok) return true;
    // some hosts reject HEAD — try GET range
    const g = await fetch(url, {
      headers: { "User-Agent": UA, Range: "bytes=0-0" },
      redirect: "follow",
    });
    return g.ok || g.status === 206;
  } catch {
    return false;
  }
}

function candidateUrls(sheetCode, name, slug) {
  const codeNum = sheetCode.replace(/^PK-/i, "").replace(/^EP-/i, "EP-");
  const pk = sheetCode.startsWith("EP") ? sheetCode : `PK-${codeNum.replace(/^PK-/i, "")}`;
  const pkCompact = pk.replace(/^PK-/i, "PK-");
  const namePart = name
    .replace(new RegExp(`^${pk}\\s*`, "i"), "")
    .replace(new RegExp(`^${codeNum}\\s*`, "i"), "")
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const slugName = slug
    .replace(/^pk-?/i, "")
    .replace(/^\d+-?/, "")
    .replace(/-lamination$/i, "");
  const bases = [
    `Pk-${codeNum.replace(/^EP-/i, "")}.jpg.jpg`,
    `PK-${codeNum.replace(/^EP-/i, "")}.jpg.jpg`,
    `Pk-${codeNum.replace(/^EP-/i, "")}.jpg`,
    `${pkCompact}-${namePart}.jpg`,
    `PK-${codeNum.replace(/^EP-/i, "")}-${namePart}.jpg`,
    `${codeNum.replace(/^EP-/i, "")}-${namePart}.jpg`,
    `${codeNum.replace(/^EP-/i, "")}-${namePart}-Patex-Lamination-1-scaled.jpg`,
    `${codeNum.replace(/^EP-/i, "")}-${namePart}-Patex-Lamination-1.jpg`,
    `PK-${slug.replace(/^pk-/i, "")}.jpg`,
    `${slug}.jpg`,
  ];
  const months = [];
  for (const y of [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]) {
    for (const m of ["07", "06", "05", "04", "03", "02", "01", "08", "09", "10", "11", "12"]) {
      months.push(`${y}/${m}`);
    }
  }
  // Prefer recent folders first (already ordered)
  const urls = [];
  const seen = new Set();
  for (const ym of months) {
    for (const b of bases) {
      const u = `https://patex.com.pk/wp-content/uploads/${ym}/${b}`;
      if (!seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    }
  }
  return urls;
}

async function resolveImage(product) {
  const sheetCode = extractSheetCode(product.title?.rendered || product.name, product.slug);
  const name = displayName(product.title?.rendered || product.name);
  if (product.imageUrl) return { ...product, sheetCode, name, imageUrl: product.imageUrl };

  const cands = candidateUrls(sheetCode, name, product.slug);
  // Fast path: try most likely recent patterns first (first ~24)
  for (const url of cands.slice(0, 24)) {
    if (await headOk(url)) return { sheetCode, name, imageUrl: url, sourceUrl: product.link };
    await sleep(20);
  }
  // Broader search
  for (const url of cands.slice(24)) {
    if (await headOk(url)) return { sheetCode, name, imageUrl: url, sourceUrl: product.link };
    await sleep(DELAY_MS);
  }
  return { sheetCode, name, imageUrl: "", sourceUrl: product.link };
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

async function fromFiles() {
  await mkdir(RAW, { recursive: true });
  const products = await loadJsonFiles("products-page-");
  if (!products.length) {
    console.error("No products-page-*.json in data/patex-raw/");
    process.exit(1);
  }

  const mediaRows = await loadJsonFiles("media-");
  const mediaById = new Map(
    mediaRows.filter((m) => m.id && m.source_url).map((m) => [m.id, m.source_url])
  );

  const byId = new Map();
  for (const p of products) {
    byId.set(p.id, p);
  }
  const unique = [...byId.values()];
  console.log(`Loaded ${unique.length} products, ${mediaById.size} media URLs`);

  const rows = [];
  for (const p of unique) {
    const name = displayName(p.title?.rendered || "");
    const sheetCode = extractSheetCode(name, p.slug);
    const imageUrl = mediaById.get(p.featured_media) || "";
    rows.push({
      id: p.id,
      slug: p.slug,
      sheetCode,
      name,
      featured_media: p.featured_media,
      imageUrl,
      sourceUrl: p.link,
      pricePKR: 0,
      dimensions: "2440*1220",
      thickness: "16mm",
      materialCategory: "Patex Lamination",
      brandName: "Patex",
    });
  }

  const missing = rows.filter((r) => !r.imageUrl);
  console.log(`With media URL: ${rows.length - missing.length}, missing: ${missing.length}`);

  if (args.has("--resolve-images") && missing.length) {
    console.log(`Resolving ${missing.length} images by URL probe...`);
    let done = 0;
    await mapPool(
      missing,
      async (row) => {
        const r = await resolveImage({
          title: { rendered: row.name },
          slug: row.slug,
          link: row.sourceUrl,
        });
        row.imageUrl = r.imageUrl;
        done++;
        if (done % 10 === 0) console.log(`  resolved ${done}/${missing.length}`);
        return row;
      },
      6
    );
  }

  const payload = {
    scrapedAt: new Date().toISOString(),
    category: "patex-lamination",
    categoryId: 109,
    count: rows.length,
    products: rows.sort((a, b) => String(a.sheetCode).localeCompare(String(b.sheetCode))),
  };
  await writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");
  const stillMissing = rows.filter((r) => !r.imageUrl).length;
  console.log(`Saved ${rows.length} → ${OUT} (missing images: ${stillMissing})`);
}

await fromFiles();
