import type { ZrkBulkRow } from "@/lib/zrk/bulk-import";

const BASE = "https://zrkgroup.com";
const LIST_URL = `${BASE}/products?producttype=MDF`;
const DELAY_MS = 100;
const CONCURRENCY = 6;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "ArtisanInteriors-ZRK-Sync/1.0",
          Accept: "text/html",
        },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(400 * (i + 1));
    }
  }
  throw new Error("fetch failed");
}

function extractProductLinks(html: string): string[] {
  return [...new Set([...html.matchAll(/href="(\/products\/\d+)"/g)].map((m) => m[1]))];
}

export async function collectZrkMdfPaths(): Promise<string[]> {
  const paths = new Set<string>();
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

  return [...paths].sort((a, b) => {
    const na = Number(a.split("/").pop());
    const nb = Number(b.split("/").pop());
    return na - nb;
  });
}

function specValue(html: string, label: string): string | undefined {
  const re = new RegExp(
    `${label}</span><span class="text-sm font-medium text-neutral-900">([^<]+)`
  );
  return html.match(re)?.[1]?.trim();
}

export function parseZrkProductPage(
  html: string,
  fallbackCode: string
): (ZrkBulkRow & { description?: string; sourceUrl: string }) | null {
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

  if (!imageUrl) return null;

  const description = html.match(
    /<p class="mb-6 text-sm leading-relaxed text-neutral-600">([^<]+)/
  )?.[1]?.trim();

  return {
    sheetCode: code,
    name,
    imageUrl,
    surfaceFinish: specValue(html, "Surface Finish"),
    colorDescription: specValue(html, "Color"),
    materialCategory,
    dimensions: specValue(html, "Dimensions") ?? "2440*1220",
    thickness: specValue(html, "Thickness") ?? "16mm",
    description,
    sourceUrl: `${BASE}/products/${code}`,
    pricePKR: 0,
  };
}

async function mapPool<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
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

export async function scrapeZrkProducts(
  paths: string[]
): Promise<{
  rows: (ZrkBulkRow & { description?: string; sourceUrl: string })[];
  errors: string[];
}> {
  const rows: (ZrkBulkRow & { description?: string; sourceUrl: string })[] = [];
  const errors: string[] = [];

  await mapPool(
    paths,
    async (productPath) => {
      const code = productPath.split("/").pop() ?? "";
      try {
        const html = await fetchText(`${BASE}${productPath}`);
        const row = parseZrkProductPage(html, code);
        if (!row) errors.push(`${code}: no image URL`);
        else rows.push(row);
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

/** Incremental sync — only fetches products not already in catalog. */
export async function discoverNewZrkProducts(existingSheetCodes: Set<string>): Promise<{
  newPaths: string[];
  totalOnSite: number;
  alreadyHave: number;
}> {
  const allPaths = await collectZrkMdfPaths();
  const newPaths = allPaths.filter((p) => {
    const code = p.split("/").pop() ?? "";
    return !existingSheetCodes.has(code);
  });
  return {
    newPaths,
    totalOnSite: allPaths.length,
    alreadyHave: allPaths.length - newPaths.length,
  };
}

export async function syncNewZrkProducts(existingSheetCodes: Set<string>): Promise<{
  rows: (ZrkBulkRow & { description?: string; sourceUrl: string })[];
  errors: string[];
  newPaths: string[];
  totalOnSite: number;
}> {
  const { newPaths, totalOnSite } = await discoverNewZrkProducts(existingSheetCodes);
  if (newPaths.length === 0) {
    return { rows: [], errors: [], newPaths: [], totalOnSite };
  }
  const { rows, errors } = await scrapeZrkProducts(newPaths);
  return { rows, errors, newPaths, totalOnSite };
}
