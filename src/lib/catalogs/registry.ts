import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { Catalog, CatalogRegistry } from "./types";
import { getCollection, COLLECTIONS, mongoInsertMany, assertJsonWriteAllowed, isVercelRuntime } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "catalogs.json");

function defaultCatalogs(): Catalog[] {
  const now = new Date().toISOString();
  return [
    {
      id: "artisan-laminates",
      companyName: "Artisan Laminates",
      global: true,
      createdAt: now,
      swatches: [
        { id: "al-ch", name: "Charcoal", hex: "#3D4555", sheetCode: "LAM-CH-01", pricePKR: 1850, palette: "wood" },
        { id: "al-wal", name: "Walnut", hex: "#5C4033", sheetCode: "LAM-WAL-18", pricePKR: 2200, palette: "wood" },
        { id: "al-oak", name: "Oak", hex: "#C4A574", sheetCode: "LAM-OAK-12", pricePKR: 1950, palette: "wood" },
        { id: "al-teak", name: "Teak", hex: "#8B6914", sheetCode: "LAM-TEK-09", pricePKR: 2400, palette: "wood" },
        { id: "al-ash", name: "Ash", hex: "#B8A99A", sheetCode: "LAM-ASH-06", pricePKR: 1650, palette: "wood" },
        { id: "al-wht", name: "White PVC", hex: "#F5F0E8", sheetCode: "LAM-WHT-02", pricePKR: 1500, palette: "wood" },
        { id: "al-esp", name: "Espresso", hex: "#4A3228", sheetCode: "LAM-ESP-15", pricePKR: 2100, palette: "wood" },
        { id: "al-hny", name: "Honey Oak", hex: "#D4A96A", sheetCode: "LAM-HNY-11", pricePKR: 2000, palette: "wood" },
        { id: "al-slt", name: "Slate Grey", hex: "#6B7280", sheetCode: "LAM-SLT-07", pricePKR: 1750, palette: "wood" },
      ],
    },
    {
      id: "greenply",
      companyName: "Greenply",
      global: true,
      createdAt: now,
      swatches: [
        { id: "gp-nvy", name: "Navy Blue", hex: "#2C3E50", sheetCode: "GP-NVY-14", pricePKR: 2100, palette: "wood" },
        { id: "gp-sge", name: "Sage Green", hex: "#7D8B6A", sheetCode: "GP-SGE-08", pricePKR: 1900, palette: "wood" },
        { id: "gp-mah", name: "Mahogany", hex: "#6B3A2A", sheetCode: "GP-MAH-22", pricePKR: 2300, palette: "wood" },
        { id: "gp-map", name: "Maple", hex: "#D4B896", sheetCode: "GP-MAP-05", pricePKR: 1750, palette: "wood" },
      ],
    },
    {
      id: "local-paint",
      companyName: "Local Paint Co",
      global: true,
      createdAt: now,
      swatches: [
        { id: "lp-ow", name: "Off-White", hex: "#F5F0E8", sheetCode: "PNT-OW-01", pricePKR: 850, palette: "paint" },
        { id: "lp-lg", name: "Light Grey", hex: "#C8C2B8", sheetCode: "PNT-LG-04", pricePKR: 900, palette: "paint" },
        { id: "lp-bg", name: "Beige", hex: "#D9CDB8", sheetCode: "PNT-BG-07", pricePKR: 880, palette: "paint" },
        { id: "lp-ch", name: "Charcoal", hex: "#3D3832", sheetCode: "PNT-CH-11", pricePKR: 950, palette: "paint" },
        { id: "lp-ws", name: "Warm Stone", hex: "#A89B8A", sheetCode: "PNT-WS-03", pricePKR: 920, palette: "paint" },
      ],
    },
    {
      id: "zrk-group",
      companyName: "ZRK Group",
      global: true,
      createdAt: now,
      swatches: [
        {
          id: "zrk-3001",
          name: "Reddish Brown Wood",
          hex: "#6B3A2A",
          sheetCode: "3001",
          pricePKR: 12500,
          palette: "wood",
          imageUrl:
            "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev/catalog-textures/zrk/3001.webp",
          thumbUrl:
            "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev/catalog-textures/zrk/thumbs/3001.webp",
        },
        {
          id: "zrk-8062",
          name: "White/Grey Marble",
          hex: "#E8E4DF",
          sheetCode: "8062",
          pricePKR: 14800,
          palette: "wood",
          imageUrl:
            "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev/catalog-textures/zrk/8062.webp",
          thumbUrl:
            "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev/catalog-textures/zrk/thumbs/8062.webp",
        },
      ],
    },
  ];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function mergeMissingDefaults(catalogs: Catalog[]): Promise<Catalog[]> {
  const defaults = defaultCatalogs();
  const ids = new Set(catalogs.map((c) => c.id));
  const merged = [...catalogs];
  let changed = false;
  for (const def of defaults) {
    if (!ids.has(def.id)) {
      merged.push(def);
      changed = true;
    }
  }
  if (changed) {
    if (isVercelRuntime()) {
      // Prefer in-memory merge only — never write data/catalogs.json on Vercel.
      return merged;
    }
    await writeJsonCatalogs(merged);
  }
  return merged;
}

async function readJsonCatalogs(): Promise<Catalog[]> {
  if (isVercelRuntime()) {
    if (!(await fileExists(REGISTRY_PATH))) {
      return defaultCatalogs();
    }
    try {
      const raw = await readFile(REGISTRY_PATH, "utf-8");
      return mergeMissingDefaults((JSON.parse(raw) as CatalogRegistry).catalogs);
    } catch {
      return defaultCatalogs();
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    const catalogs = defaultCatalogs();
    await writeFile(REGISTRY_PATH, JSON.stringify({ catalogs }, null, 2), "utf-8");
    return catalogs;
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  const catalogs = (JSON.parse(raw) as CatalogRegistry).catalogs;
  return mergeMissingDefaults(catalogs);
}

async function writeJsonCatalogs(catalogs: Catalog[]): Promise<void> {
  assertJsonWriteAllowed("data/catalogs.json");
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ catalogs }, null, 2), "utf-8");
}

function swatchCount(catalogs: Catalog[]): number {
  return catalogs.reduce((n, c) => n + (c.swatches?.length ?? 0), 0);
}

async function readAllCatalogs(): Promise<Catalog[]> {
  const jsonCatalogs = await readJsonCatalogs();
  try {
    const col = await getCollection(COLLECTIONS.catalogs);
    if (col) {
      const count = await col.countDocuments();
      if (count === 0) {
        await mongoInsertMany(COLLECTIONS.catalogs, jsonCatalogs);
        return jsonCatalogs;
      }
      const docs = await col.find({}).toArray();
      const mongoCatalogs = docs.map(({ _id, ...rest }) => rest as Catalog);
      // Prefer richer JSON after deploys (e.g. 340 ZRK) over stale Mongo seed
      if (swatchCount(jsonCatalogs) > swatchCount(mongoCatalogs)) {
        await col.deleteMany({});
        await mongoInsertMany(COLLECTIONS.catalogs, jsonCatalogs);
        return jsonCatalogs;
      }
      return mongoCatalogs;
    }
  } catch (err) {
    console.warn("[catalogs] MongoDB read failed — using JSON:", (err as Error).message);
  }
  return jsonCatalogs;
}

export async function ensureCatalogRegistry(): Promise<CatalogRegistry> {
  return { catalogs: await readAllCatalogs() };
}

export async function readCatalogRegistry(): Promise<CatalogRegistry> {
  return ensureCatalogRegistry();
}

export async function writeCatalogRegistry(registry: CatalogRegistry): Promise<void> {
  const col = await getCollection(COLLECTIONS.catalogs);
  if (col) {
    await col.deleteMany({});
    if (registry.catalogs.length > 0) {
      await mongoInsertMany(COLLECTIONS.catalogs, registry.catalogs);
    }
    return;
  }
  assertJsonWriteAllowed("data/catalogs.json");
  await writeJsonCatalogs(registry.catalogs);
}

export async function listCatalogs(): Promise<Catalog[]> {
  return readAllCatalogs();
}

export async function getCatalogById(id: string): Promise<Catalog | undefined> {
  const col = await getCollection(COLLECTIONS.catalogs);
  if (col) {
    const doc = await col.findOne({ id });
    if (doc) {
      const { _id, ...rest } = doc as unknown as Catalog & { _id?: string };
      return rest;
    }
    return undefined;
  }
  const catalogs = await readJsonCatalogs();
  return catalogs.find((c) => c.id === id);
}

export async function saveCatalog(catalog: Catalog): Promise<void> {
  const col = await getCollection(COLLECTIONS.catalogs);
  if (col) {
    await col.updateOne(
      { id: catalog.id },
      { $set: catalog },
      { upsert: true }
    );
    return;
  }
  assertJsonWriteAllowed("data/catalogs.json");
  const catalogs = await readJsonCatalogs();
  const idx = catalogs.findIndex((c) => c.id === catalog.id);
  if (idx >= 0) catalogs[idx] = catalog;
  else catalogs.push(catalog);
  await writeJsonCatalogs(catalogs);
}

export async function deleteCatalog(id: string): Promise<boolean> {
  const col = await getCollection(COLLECTIONS.catalogs);
  if (col) {
    const result = await col.deleteOne({ id });
    return result.deletedCount > 0;
  }
  assertJsonWriteAllowed("data/catalogs.json");
  const catalogs = await readJsonCatalogs();
  const filtered = catalogs.filter((c) => c.id !== id);
  if (filtered.length === catalogs.length) return false;
  await writeJsonCatalogs(filtered);
  return true;
}

export function slugifyCatalogId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "catalog"
  );
}
