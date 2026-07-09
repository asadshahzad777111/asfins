import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { Product, ProductRegistry } from "./types";
import { getCollection, COLLECTIONS, mongoInsertMany } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "products.json");

function defaultProducts(): Product[] {
  const now = new Date().toISOString();
  return [
    {
      id: "zrk-3001",
      name: "High Gloss Elite — Reddish Brown",
      pricePKR: 12500,
      image: "/catalog/3001.png",
      category: "wood-laminate",
      description:
        "Premium wood-grain laminate with a mirror-like high gloss finish. Ideal for modern kitchen cabinetry with rich reddish-brown tones.",
      active: true,
      createdAt: now,
      productCode: "3001",
      surfaceFinish: "High Gloss Elite",
      colorDescription: "Reddish Brown",
      dimensions: "2440 × 1220 mm",
      thickness: "16 mm",
      idealApplications: "Kitchen Cabinets",
      brandName: "ZRK Group",
    },
    {
      id: "zrk-8062",
      name: "UV Lux — White/Grey Marble",
      pricePKR: 14800,
      image: "/catalog/8062.png",
      category: "marble",
      description:
        "UV-cured marble-look surface with elegant white and grey veining. Durable, scratch-resistant finish for contemporary kitchens.",
      active: true,
      createdAt: now,
      productCode: "8062",
      surfaceFinish: "UV Lux",
      colorDescription: "White/Grey",
      dimensions: "2440 × 1220 mm / 2800 × 1220 mm",
      thickness: "16 / 17 / 18 mm",
      idealApplications: "Kitchen Cabinets",
      brandName: "ZRK Group",
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

async function readJsonProducts(): Promise<Product[]> {
  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    const products = defaultProducts();
    await writeFile(REGISTRY_PATH, JSON.stringify({ products }, null, 2), "utf-8");
    return products;
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  return (JSON.parse(raw) as ProductRegistry).products;
}

async function writeJsonProducts(products: Product[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ products }, null, 2), "utf-8");
}

async function readAllProducts(): Promise<Product[]> {
  const col = await getCollection(COLLECTIONS.products);
  if (col) {
    const count = await col.countDocuments();
    if (count === 0) {
      const defaults = defaultProducts();
      await mongoInsertMany(COLLECTIONS.products, defaults);
      return defaults;
    }
    const docs = await col.find({}).toArray();
    return docs.map(({ _id, ...rest }) => rest as Product);
  }
  return readJsonProducts();
}

export async function ensureProductRegistry(): Promise<ProductRegistry> {
  return { products: await readAllProducts() };
}

export async function readProductRegistry(): Promise<ProductRegistry> {
  return ensureProductRegistry();
}

export async function writeProductRegistry(registry: ProductRegistry): Promise<void> {
  const col = await getCollection(COLLECTIONS.products);
  if (col) {
    await col.deleteMany({});
    if (registry.products.length > 0) {
      await mongoInsertMany(COLLECTIONS.products, registry.products);
    }
    return;
  }
  await writeJsonProducts(registry.products);
}

export async function listProducts(activeOnly = false): Promise<Product[]> {
  const products = await readAllProducts();
  return activeOnly ? products.filter((p) => p.active) : products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const col = await getCollection(COLLECTIONS.products);
  if (col) {
    const doc = await col.findOne({ id });
    if (doc) {
      const { _id, ...rest } = doc as unknown as Product & { _id?: string };
      return rest;
    }
    return undefined;
  }
  const products = await readJsonProducts();
  return products.find((p) => p.id === id);
}

export async function saveProduct(product: Product): Promise<void> {
  const col = await getCollection(COLLECTIONS.products);
  if (col) {
    await col.updateOne(
      { id: product.id },
      { $set: product },
      { upsert: true }
    );
    return;
  }
  const products = await readJsonProducts();
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx >= 0) products[idx] = product;
  else products.push(product);
  await writeJsonProducts(products);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const col = await getCollection(COLLECTIONS.products);
  if (col) {
    const result = await col.deleteOne({ id });
    return result.deletedCount > 0;
  }
  const products = await readJsonProducts();
  const filtered = products.filter((p) => p.id !== id);
  if (filtered.length === products.length) return false;
  await writeJsonProducts(filtered);
  return true;
}

export function slugifyProductId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "product"
  );
}
