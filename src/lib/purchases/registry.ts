import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { Purchase, PurchaseRegistry } from "./types";
import { getCollection, COLLECTIONS, assertJsonWriteAllowed, isVercelRuntime } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "purchases.json");

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonPurchases(): Promise<Purchase[]> {
  if (isVercelRuntime()) {
    if (!(await fileExists(REGISTRY_PATH))) return [];
    try {
      const raw = await readFile(REGISTRY_PATH, "utf-8");
      return (JSON.parse(raw) as PurchaseRegistry).purchases;
    } catch {
      return [];
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    await writeFile(REGISTRY_PATH, JSON.stringify({ purchases: [] }, null, 2), "utf-8");
    return [];
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  return (JSON.parse(raw) as PurchaseRegistry).purchases;
}

async function writeJsonPurchases(purchases: Purchase[]): Promise<void> {
  assertJsonWriteAllowed("data/purchases.json");
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ purchases }, null, 2), "utf-8");
}

async function readAllPurchases(): Promise<Purchase[]> {
  const col = await getCollection(COLLECTIONS.purchases);
  if (col) {
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...rest }) => rest as Purchase);
  }
  return readJsonPurchases();
}

export async function listPurchases(): Promise<Purchase[]> {
  return readAllPurchases();
}

export async function savePurchase(purchase: Purchase): Promise<void> {
  const col = await getCollection(COLLECTIONS.purchases);
  if (col) {
    await col.updateOne({ id: purchase.id }, { $set: purchase }, { upsert: true });
    return;
  }
  assertJsonWriteAllowed("data/purchases.json");
  const purchases = await readJsonPurchases();
  const idx = purchases.findIndex((p) => p.id === purchase.id);
  if (idx >= 0) purchases[idx] = purchase;
  else purchases.push(purchase);
  await writeJsonPurchases(purchases);
}

export async function deletePurchase(id: string): Promise<boolean> {
  const col = await getCollection(COLLECTIONS.purchases);
  if (col) {
    const result = await col.deleteOne({ id });
    return result.deletedCount > 0;
  }
  assertJsonWriteAllowed("data/purchases.json");
  const purchases = await readJsonPurchases();
  const filtered = purchases.filter((p) => p.id !== id);
  if (filtered.length === purchases.length) return false;
  await writeJsonPurchases(filtered);
  return true;
}

export function slugifyPurchaseId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "purchase"
  );
}
