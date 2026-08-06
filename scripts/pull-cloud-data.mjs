#!/usr/bin/env node
/**
 * Pull live shop data from asfins.com into a dated local backup.
 * Use this on a laptop (or in cloud) to refresh a copy without Mongo credentials.
 *
 * Usage:
 *   node scripts/pull-cloud-data.mjs
 *   npm run pull-cloud-data
 *   SITE_URL=https://www.asfins.com node scripts/pull-cloud-data.mjs
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const SITE = (process.env.SITE_URL || "https://www.asfins.com").replace(/\/$/, "");
const ROOT = new URL("..", import.meta.url).pathname;
const stamp = new Date().toISOString().slice(0, 10);
const outDir = join(ROOT, "data", "cloud-backups", stamp);

async function fetchJson(path) {
  const res = await fetch(`${SITE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}`);
  }
  return res.json();
}

function countSwatches(catalogs) {
  return (catalogs || []).reduce((n, c) => n + (c.swatches?.length || 0), 0);
}

async function main() {
  console.log(`Pulling live data from ${SITE} …`);
  const [catalogs, products, scenes] = await Promise.all([
    fetchJson("/api/catalogs"),
    fetchJson("/api/products"),
    fetchJson("/api/scenes"),
  ]);

  await mkdir(outDir, { recursive: true });
  for (const [name, data] of Object.entries({ catalogs, products, scenes })) {
    await writeFile(join(outDir, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
  }

  let localProducts = [];
  try {
    const raw = JSON.parse(await readFile(join(ROOT, "data", "products.json"), "utf8"));
    localProducts = raw.products || [];
  } catch {
    /* optional */
  }

  const liveProducts = products.products || [];
  const liveCats = catalogs.catalogs || [];
  const onlyLocal = localProducts
    .filter((p) => !liveProducts.some((lp) => lp.id === p.id))
    .map((p) => p.id);

  const manifest = {
    syncedAt: new Date().toISOString(),
    source: SITE,
    comparison: {
      catalogs: {
        live: liveCats.length,
        liveSwatches: countSwatches(liveCats),
      },
      products: {
        live: liveProducts.length,
        local: localProducts.length,
        onlyLocal,
      },
      scenes: {
        live: (scenes.scenes || []).length,
      },
    },
    files: ["catalogs.json", "products.json", "scenes.json", "SYNC_STATUS.json"],
    note: "Public API snapshot for laptop use. Orders/inquiries need admin/Mongo credentials.",
  };

  await writeFile(join(outDir, "SYNC_STATUS.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Saved → data/cloud-backups/${stamp}/`);
  console.log(
    `  catalogs: ${liveCats.length} (${countSwatches(liveCats)} swatches), products: ${liveProducts.length}, scenes: ${(scenes.scenes || []).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
