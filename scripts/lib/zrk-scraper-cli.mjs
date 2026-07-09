/** Shared CLI scraper helpers (used by scrape + sync scripts). */
const BASE = "https://zrkgroup.com";
const LIST_URL = `${BASE}/products?producttype=MDF`;
const CONCURRENCY = 8;
const DELAY_MS = 120;

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
}

function extractProductLinks(html) {
  return [...new Set([...html.matchAll(/href="(\/products\/\d+)"/g)].map((m) => m[1]))];
}

export async function collectAllProductPaths() {
  const paths = new Set();
  let page = 1;
  let stable = 0;

  while (page <= 25 && stable < 2) {
    const html = await fetchText(`${LIST_URL}&page=${page}`);
    const before = paths.size;
    for (const p of extractProductLinks(html)) paths.add(p);
    if (paths.size === before) stable++;
    else stable = 0;
    page++;
    await sleep(DELAY_MS);
  }

  return [...paths].sort((a, b) => Number(a.split("/").pop()) - Number(b.split("/").pop()));
}

function specValue(html, label) {
  const re = new RegExp(
    `${label}</span><span class="text-sm font-medium text-neutral-900">([^<]+)`
  );
  return html.match(re)?.[1]?.trim();
}

function parseProductPage(html, fallbackCode) {
  const code =
    html.match(/<p class="mb-4 text-sm tracking-wide text-neutral-400">(\d+)<\/p>/)?.[1] ??
    fallbackCode;
  const name = html.match(/<h1[^>]*>([^<]+)/)?.[1]?.trim() ?? `ZRK ${code}`;
  const materialCategory =
    html.match(/tracking-widest text-neutral-500 uppercase">([^<]+)<\/span><h1/)?.[1]?.trim() ??
    "Textured Laminates";
  const imgs = [
    ...new Set(
      [...html.matchAll(/_next\/image\?url=([^&"']+)/g)]
        .map((m) => decodeURIComponent(m[1]))
        .filter((u) => u.includes("strapi.zrkgroup.com/uploads"))
    ),
  ];
  const imageUrl =
    imgs.find((u) => u.includes(`/${code}_`) || u.includes(`/${code}.`)) ?? imgs[0] ?? "";
  if (!imageUrl) return null;
  return {
    sheetCode: code,
    name,
    imageUrl,
    surfaceFinish: specValue(html, "Surface Finish"),
    colorDescription: specValue(html, "Color"),
    materialCategory,
    dimensions: specValue(html, "Dimensions") ?? "2440*1220",
    thickness: specValue(html, "Thickness") ?? "16mm",
    pricePKR: 0,
  };
}

async function mapPool(items, fn, concurrency) {
  let idx = 0;
  const results = [];
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

export async function scrapeDetails(paths) {
  const rows = [];
  const errors = [];
  await mapPool(
    paths,
    async (productPath) => {
      const code = productPath.split("/").pop();
      try {
        const html = await fetchText(`${BASE}${productPath}`);
        const row = parseProductPage(html, code);
        if (!row) errors.push(`${code}: no image`);
        else rows.push(row);
        await sleep(DELAY_MS);
      } catch (e) {
        errors.push(`${code}: ${e.message}`);
      }
    },
    CONCURRENCY
  );
  rows.sort((a, b) => Number(a.sheetCode) - Number(b.sheetCode));
  return { rows, errors };
}
