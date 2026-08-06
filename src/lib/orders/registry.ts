import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { OrderRegistry, OrderStatus, ShopOrder } from "./types";
import {
  getCollection,
  COLLECTIONS,
  assertJsonWriteAllowed,
  isVercelRuntime,
} from "@/lib/db/client";
import { getProductById, saveProduct } from "@/lib/products/registry";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "orders.json");

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonOrders(): Promise<ShopOrder[]> {
  if (isVercelRuntime()) {
    if (!(await fileExists(REGISTRY_PATH))) return [];
    try {
      const raw = await readFile(REGISTRY_PATH, "utf-8");
      return (JSON.parse(raw) as OrderRegistry).orders;
    } catch {
      return [];
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    await writeFile(REGISTRY_PATH, JSON.stringify({ orders: [] }, null, 2), "utf-8");
    return [];
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  return (JSON.parse(raw) as OrderRegistry).orders;
}

async function writeJsonOrders(orders: ShopOrder[]): Promise<void> {
  assertJsonWriteAllowed("data/orders.json");
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ orders }, null, 2), "utf-8");
}

async function readAllOrders(): Promise<ShopOrder[]> {
  const col = await getCollection(COLLECTIONS.orders);
  if (col) {
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...rest }) => rest as ShopOrder);
  }
  return readJsonOrders();
}

export async function listOrders(): Promise<ShopOrder[]> {
  const orders = await readAllOrders();
  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getOrderById(id: string): Promise<ShopOrder | undefined> {
  const col = await getCollection(COLLECTIONS.orders);
  if (col) {
    const doc = await col.findOne({ id });
    if (!doc) return undefined;
    const { _id, ...rest } = doc as unknown as ShopOrder & { _id?: string };
    return rest;
  }
  const orders = await readJsonOrders();
  return orders.find((o) => o.id === id);
}

export async function saveOrder(order: ShopOrder): Promise<void> {
  const col = await getCollection(COLLECTIONS.orders);
  if (col) {
    await col.updateOne({ id: order.id }, { $set: order }, { upsert: true });
    return;
  }
  assertJsonWriteAllowed("data/orders.json");
  const orders = await readJsonOrders();
  const idx = orders.findIndex((o) => o.id === idOf(order));
  if (idx >= 0) orders[idx] = order;
  else orders.unshift(order);
  await writeJsonOrders(orders);
}

function idOf(order: ShopOrder): string {
  return order.id;
}

export async function nextOrderNumber(): Promise<string> {
  const orders = await readAllOrders();
  const max = orders.reduce((acc, o) => {
    const m = /^ASF-(\d+)$/i.exec(o.orderNumber || "");
    if (!m) return acc;
    return Math.max(acc, Number(m[1]));
  }, 1000);
  return `ASF-${max + 1}`;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<ShopOrder | null> {
  const order = await getOrderById(id);
  if (!order) return null;

  const next: ShopOrder = {
    ...order,
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === "confirmed" && !order.stockDecremented) {
    await decrementStockForOrder(next);
    next.stockDecremented = true;
  }

  await saveOrder(next);
  return next;
}

async function decrementStockForOrder(order: ShopOrder): Promise<void> {
  for (const item of order.items) {
    const product = await getProductById(item.productId);
    if (!product || product.stock == null) continue;
    const nextStock = Math.max(0, product.stock - item.qty);
    await saveProduct({ ...product, stock: nextStock });
  }
}

export function createOrderId(): string {
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
