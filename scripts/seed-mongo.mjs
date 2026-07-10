/**
 * Push data/*.json into MongoDB (first deploy or reset).
 * Usage: npm run seed-mongo
 * Loads MONGODB_URI / MONGODB_DB_NAME from env or .env.local (does not print secrets).
 */
import { readFile, access } from "fs/promises";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

// Some local/router DNS resolvers refuse SRV (querySrv ECONNREFUSED on Windows).
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  try {
    await access(envPath);
  } catch {
    return;
  }
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

await loadEnvLocal();

const DB_NAME = process.env.MONGODB_DB_NAME ?? "asfins";
const uri = process.env.MONGODB_URI;
if (!uri || uri.includes("YOUR_")) {
  console.error(
    "Set MONGODB_URI in .env.local or the environment first. See MONGODB_SETUP.md"
  );
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
