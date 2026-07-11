import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { Sale, SaleRegistry } from "./types";
import { getCollection, COLLECTIONS, assertJsonWriteAllowed, isVercelRuntime } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "sales.json");

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSales(): Promise<Sale[]> {
  if (isVercelRuntime()) {
    if (!(await fileExists(REGISTRY_PATH))) return [];
    try {
      const raw = await readFile(REGISTRY_PATH, "utf-8");
      return (JSON.parse(raw) as SaleRegistry).sales;
    } catch {
      return [];
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    await writeFile(REGISTRY_PATH, JSON.stringify({ sales: [] }, null, 2), "utf-8");
    return [];
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  return (JSON.parse(raw) as SaleRegistry).sales;
}

async function writeJsonSales(sales: Sale[]): Promise<void> {
  assertJsonWriteAllowed("data/sales.json");
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ sales }, null, 2), "utf-8");
}

async function readAllSales(): Promise<Sale[]> {
  const col = await getCollection(COLLECTIONS.sales);
  if (col) {
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...rest }) => rest as Sale);
  }
  return readJsonSales();
}

export async function listSales(): Promise<Sale[]> {
  return readAllSales();
}

export async function saveSale(sale: Sale): Promise<void> {
  const col = await getCollection(COLLECTIONS.sales);
  if (col) {
    await col.updateOne({ id: sale.id }, { $set: sale }, { upsert: true });
    return;
  }
  assertJsonWriteAllowed("data/sales.json");
  const sales = await readJsonSales();
  const idx = sales.findIndex((s) => s.id === sale.id);
  if (idx >= 0) sales[idx] = sale;
  else sales.push(sale);
  await writeJsonSales(sales);
}

export async function deleteSale(id: string): Promise<boolean> {
  const col = await getCollection(COLLECTIONS.sales);
  if (col) {
    const result = await col.deleteOne({ id });
    return result.deletedCount > 0;
  }
  assertJsonWriteAllowed("data/sales.json");
  const sales = await readJsonSales();
  const filtered = sales.filter((s) => s.id !== id);
  if (filtered.length === sales.length) return false;
  await writeJsonSales(filtered);
  return true;
}

export function slugifySaleId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "sale"
  );
}
