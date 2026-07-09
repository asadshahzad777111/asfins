import { MongoClient, type Db, type Collection, type Document } from "mongodb";

/** Dedicated database for asfins.com — NOT shared with asfixgear */
export const DB_NAME = process.env.MONGODB_DB_NAME ?? "asfins";

export const COLLECTIONS = {
  scenes: "scenes",
  catalogs: "catalogs",
  products: "products",
  inquiries: "inquiries",
  orders: "orders",
  sales: "sales",
  purchases: "purchases",
} as const;

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoUnavailable = false;

function isPlaceholderUri(uri: string): boolean {
  const placeholders = [
    "YOUR_GMAIL_USER",
    "YOUR_PASSWORD",
    "NEW_CLUSTER",
    "<password>",
    "<username>",
  ];
  return placeholders.some((p) => uri.includes(p));
}

export function isValidMongoUri(uri?: string): boolean {
  if (!uri) return false;
  if (isPlaceholderUri(uri)) return false;
  return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
}

export async function getDb(): Promise<Db | null> {
  if (mongoUnavailable) return null;

  const uri = process.env.MONGODB_URI;
  if (!isValidMongoUri(uri)) return null;

  try {
    if (!client) {
      client = new MongoClient(uri!, {
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      db = client.db(DB_NAME);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[db] Connected to MongoDB: ${DB_NAME}`);
      }
    }
    return db;
  } catch (err) {
    mongoUnavailable = true;
    console.warn(
      "[db] MongoDB unavailable — using JSON file fallback:",
      (err as Error).message
    );
    return null;
  }
}

export async function getCollection<T extends Document>(
  name: string
): Promise<Collection<T> | null> {
  const database = await getDb();
  if (!database) return null;
  return database.collection<T>(name);
}

/** Prepare docs for MongoDB insert (string _id from id field) */
export function mongoIdDocs<T extends { id: string }>(items: T[]) {
  return items.map((item) => ({ ...item, _id: item.id }));
}

export async function mongoInsertMany<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  const col = await getCollection(collectionName);
  if (!col || items.length === 0) return;
  await col.insertMany(mongoIdDocs(items) as Document[]);
}

export async function mongoInsertOne<T extends { id: string }>(
  collectionName: string,
  item: T
): Promise<void> {
  const col = await getCollection(collectionName);
  if (!col) return;
  await col.insertOne({ ...item, _id: item.id } as Document);
}

export function usingMongo(): boolean {
  return isValidMongoUri(process.env.MONGODB_URI) && !mongoUnavailable;
}
