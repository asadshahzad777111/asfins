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
let mongoUnavailableReason = "";

/** True on Vercel — `/var/task` is read-only; never write `data/*.json` there. */
export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

export class MongoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MongoUnavailableError";
  }
}

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

function describeUriProblem(uri?: string): string {
  if (!uri) return "MONGODB_URI is not set";
  if (isPlaceholderUri(uri)) return "MONGODB_URI still contains placeholder credentials";
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    return "MONGODB_URI must start with mongodb:// or mongodb+srv://";
  }
  return "MONGODB_URI is invalid";
}

/** Human-readable reason Mongo is unavailable (for logs / 503 bodies). */
export function getMongoUnavailableReason(): string {
  if (mongoUnavailable && mongoUnavailableReason) return mongoUnavailableReason;
  const uri = process.env.MONGODB_URI;
  if (!isValidMongoUri(uri)) return describeUriProblem(uri);
  return "MongoDB connection not established";
}

/**
 * On Vercel, metadata registries must use Mongo — JSON under `data/` is read-only.
 * Locally, JSON fallback remains allowed for offline/dev use.
 */
export function assertJsonWriteAllowed(registryLabel: string): void {
  if (!isVercelRuntime()) return;
  throw new MongoUnavailableError(
    `Cannot write ${registryLabel} on Vercel (read-only filesystem). MongoDB is required. ${getMongoUnavailableReason()}. Check MONGODB_URI, MONGODB_DB_NAME, and Atlas Network Access (allow 0.0.0.0/0 for serverless).`
  );
}

/** Fail fast on Vercel before long uploads if Mongo cannot be reached. */
export async function assertMongoReady(): Promise<void> {
  if (!isVercelRuntime()) return;
  const database = await getDb();
  if (!database) {
    throw new MongoUnavailableError(
      `MongoDB is required on Vercel but unavailable (${getMongoUnavailableReason()}). Scene metadata cannot be saved. Check MONGODB_URI / MONGODB_DB_NAME and Atlas network access, then redeploy.`
    );
  }
}

export async function getDb(): Promise<Db | null> {
  if (mongoUnavailable) return null;

  const uri = process.env.MONGODB_URI;
  if (!isValidMongoUri(uri)) {
    const reason = describeUriProblem(uri);
    mongoUnavailable = true;
    mongoUnavailableReason = reason;
    if (isVercelRuntime()) {
      console.error(`[db] ${reason} — JSON fallback is disabled on Vercel`);
    } else {
      console.warn(`[db] ${reason} — using JSON file fallback`);
    }
    return null;
  }

  try {
    if (!client) {
      console.log(
        `[db] Connecting to MongoDB (db=${DB_NAME}, vercel=${isVercelRuntime()})…`
      );
      client = new MongoClient(uri!, {
        serverSelectionTimeoutMS: 8000,
      });
      await client.connect();
      db = client.db(DB_NAME);
      console.log(`[db] Connected to MongoDB: ${DB_NAME}`);
    }
    return db;
  } catch (err) {
    mongoUnavailable = true;
    mongoUnavailableReason = (err as Error).message || "connection failed";
    client = null;
    db = null;
    if (isVercelRuntime()) {
      console.error(
        `[db] MongoDB connection failed — JSON fallback disabled on Vercel:`,
        mongoUnavailableReason
      );
    } else {
      console.warn(
        "[db] MongoDB unavailable — using JSON file fallback:",
        mongoUnavailableReason
      );
    }
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
