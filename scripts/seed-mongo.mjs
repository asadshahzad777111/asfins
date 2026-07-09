/**
 * Push data/*.json into MongoDB (first deploy or reset).
 * Usage: MONGODB_URI=... node scripts/seed-mongo.mjs
 */
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_NAME = process.env.MONGODB_DB_NAME ?? "asfins";

const uri = process.env.MONGODB_URI;
if (!uri || uri.includes("YOUR_")) {
  console.error("Set MONGODB_URI in environment first.");
  process.exit(1);
}

const files = [
  { file: "data/scenes.json", collection: "scenes", key: "scenes" },
  { file: "data/catalogs.json", collection: "catalogs", key: "catalogs" },
  { file: "data/products.json", collection: "products", key: "products" },
  { file: "data/inquiries.json", collection: "inquiries", key: "inquiries" },
  { file: "data/sales.json", collection: "sales", key: "sales" },
  { file: "data/purchases.json", collection: "purchases", key: "purchases" },
];

const client = new MongoClient(uri);
await client.connect();
const db = client.db(DB_NAME);
console.log(`Connected: ${DB_NAME}\n`);

for (const { file, collection, key } of files) {
  try {
    const raw = await readFile(path.join(ROOT, file), "utf8");
    const data = JSON.parse(raw);
    const items = data[key] ?? data;
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`Skip ${collection} (empty)`);
      continue;
    }
    const col = db.collection(collection);
    await col.deleteMany({});
    const docs = items.map((item) => ({ ...item, _id: item.id }));
    await col.insertMany(docs);
    console.log(`OK ${collection}: ${docs.length} documents`);
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log(`Skip ${collection} (no file)`);
    } else {
      console.error(`ERR ${collection}:`, e.message);
    }
  }
}

await client.close();
console.log("\nSeed complete.");
