import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { Inquiry, InquiryRegistry } from "./types";
import { getCollection, COLLECTIONS, mongoInsertMany, mongoInsertOne } from "@/lib/db/client";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "inquiries.json");

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonInquiries(): Promise<Inquiry[]> {
  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    await writeFile(REGISTRY_PATH, JSON.stringify({ inquiries: [] }, null, 2), "utf-8");
    return [];
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  return (JSON.parse(raw) as InquiryRegistry).inquiries;
}

async function writeJsonInquiries(inquiries: Inquiry[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ inquiries }, null, 2), "utf-8");
}

export async function ensureInquiryRegistry(): Promise<InquiryRegistry> {
  return { inquiries: await listInquiries() };
}

export async function readInquiryRegistry(): Promise<InquiryRegistry> {
  return ensureInquiryRegistry();
}

export async function writeInquiryRegistry(registry: InquiryRegistry): Promise<void> {
  const col = await getCollection(COLLECTIONS.inquiries);
  if (col) {
    await col.deleteMany({});
    if (registry.inquiries.length > 0) {
      await mongoInsertMany(COLLECTIONS.inquiries, registry.inquiries);
    }
    return;
  }
  await writeJsonInquiries(registry.inquiries);
}

export async function listInquiries(): Promise<Inquiry[]> {
  const col = await getCollection(COLLECTIONS.inquiries);
  if (col) {
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...rest }) => rest as Inquiry);
  }
  const inquiries = await readJsonInquiries();
  return inquiries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function addInquiry(inquiry: Inquiry): Promise<void> {
  const col = await getCollection(COLLECTIONS.inquiries);
  if (col) {
    await mongoInsertOne(COLLECTIONS.inquiries, inquiry);
    return;
  }
  const inquiries = await readJsonInquiries();
  inquiries.unshift(inquiry);
  await writeJsonInquiries(inquiries);
}
