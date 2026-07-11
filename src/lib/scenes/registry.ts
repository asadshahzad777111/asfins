import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type {
  SceneConfig,
  SceneRecord,
  SceneRegistry,
  SceneZoneConfig,
  RoomCategory,
  ZonePalette,
} from "./types";
import { ZONE_META } from "./types";
import {
  getCollection,
  COLLECTIONS,
  mongoInsertMany,
  assertJsonWriteAllowed,
  isVercelRuntime,
  getMongoUnavailableReason,
  MongoUnavailableError,
} from "@/lib/db/client";
import { getSceneWorkDir } from "@/lib/storage/scene-assets";

const DATA_DIR = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(DATA_DIR, "scenes.json");

function defaultScenes(): SceneRecord[] {
  const now = new Date().toISOString();
  const kitchen1Base = "/scenes/kitchen-1";
  const kitchen1: SceneRecord = {
    id: "kitchen-1",
    name: "Modern Black Kitchen",
    description:
      "AI kitchen — black cabinets cut transparent (Photopea-style). Tap wood colour on cabinets & island.",
    category: "kitchen",
    width: 1024,
    height: 682,
    thumbnail: `${kitchen1Base}/thumb.jpg`,
    basePhoto: `${kitchen1Base}/base.jpg`,
    highlightMap: `${kitchen1Base}/highlight-gloss.png`,
    nightGlow: `${kitchen1Base}/night-glow.png`,
    createdAt: now,
    published: true,
    catalogIds: ["artisan-laminates", "greenply", "local-paint", "zrk-group"],
    zones: [
      {
        id: "upper-cabinets",
        label: "Upper Cabinets",
        ...ZONE_META["upper-cabinets"],
        maskPath: `${kitchen1Base}/mask-upper-cabinets.png`,
      },
      {
        id: "lower-cabinets",
        label: "Lower Cabinets & Island",
        ...ZONE_META["lower-cabinets"],
        maskPath: `${kitchen1Base}/mask-lower-cabinets.png`,
      },
    ],
  };

  const kitchenRealBase = "/scenes/kitchen-real";
  const kitchenReal: SceneRecord = {
    id: "kitchen-real",
    name: "Real Kitchen Photo",
    description: "Aapki kitchen photo — cabinet colour catalog se change karein",
    category: "kitchen",
    width: 768,
    height: 1024,
    thumbnail: `${kitchenRealBase}/base.jpg`,
    basePhoto: `${kitchenRealBase}/base.jpg`,
    highlightMap: `${kitchenRealBase}/highlight-gloss.png`,
    nightGlow: `${kitchenRealBase}/night-glow.png`,
    createdAt: now,
    published: true,
    catalogIds: ["artisan-laminates", "greenply", "zrk-group"],
    zones: [
      {
        id: "cabinets",
        label: "Lower Cabinets",
        ...ZONE_META.cabinets,
        maskPath: `${kitchenRealBase}/mask-cabinets.png`,
      },
    ],
  };

  const kitchenModernBase = "/scenes/kitchen-modern";
  const kitchenModern: SceneRecord = {
    id: "kitchen-modern",
    name: "Modern Black Kitchen",
    description: "Black cabinets, white marble island — apna wood colour choose karein",
    category: "kitchen",
    width: 1024,
    height: 682,
    thumbnail: `${kitchenModernBase}/thumb.jpg`,
    basePhoto: `${kitchenModernBase}/base.jpg`,
    highlightMap: `${kitchenModernBase}/highlight-gloss.png`,
    nightGlow: `${kitchenModernBase}/night-glow.png`,
    createdAt: now,
    published: true,
    catalogIds: ["artisan-laminates", "greenply", "local-paint", "zrk-group"],
    zones: [
      {
        id: "cabinets",
        label: "Cabinets",
        ...ZONE_META.cabinets,
        maskPath: `${kitchenModernBase}/mask-cabinets.png`,
      },
    ],
  };

  return [kitchen1, kitchenReal, kitchenModern];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function migrateSceneFields(scenes: SceneRecord[]): { scenes: SceneRecord[]; migrated: boolean } {
  let migrated = false;
  for (const scene of scenes) {
    if (!scene.category) {
      scene.category = "kitchen";
      migrated = true;
    }
    if (!scene.catalogIds) {
      scene.catalogIds = ["artisan-laminates", "greenply", "local-paint", "zrk-group"];
      migrated = true;
    } else if (
      scene.category === "kitchen" &&
      !scene.catalogIds.includes("zrk-group")
    ) {
      scene.catalogIds.push("zrk-group");
      migrated = true;
    }
  }
  return { scenes, migrated };
}

async function readJsonScenes(): Promise<SceneRecord[]> {
  // Vercel `/var/task` is read-only — never mkdir/write `data/scenes.json` there.
  if (isVercelRuntime()) {
    if (!(await fileExists(REGISTRY_PATH))) {
      console.warn(
        `[scenes] Mongo unavailable (${getMongoUnavailableReason()}) and no bundled scenes.json — returning defaults (read-only)`
      );
      return defaultScenes();
    }
    try {
      const raw = await readFile(REGISTRY_PATH, "utf-8");
      const registry = JSON.parse(raw) as SceneRegistry;
      return migrateSceneFields(registry.scenes).scenes;
    } catch (err) {
      console.warn("[scenes] Failed to read bundled scenes.json:", (err as Error).message);
      return defaultScenes();
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(REGISTRY_PATH))) {
    const scenes = defaultScenes();
    await writeFile(REGISTRY_PATH, JSON.stringify({ scenes }, null, 2), "utf-8");
    return scenes;
  }
  const raw = await readFile(REGISTRY_PATH, "utf-8");
  const registry = JSON.parse(raw) as SceneRegistry;
  const { scenes, migrated } = migrateSceneFields(registry.scenes);
  if (migrated) {
    await writeFile(REGISTRY_PATH, JSON.stringify({ scenes }, null, 2), "utf-8");
  }
  return scenes;
}

async function writeJsonScenes(scenes: SceneRecord[]): Promise<void> {
  assertJsonWriteAllowed("data/scenes.json");
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify({ scenes }, null, 2), "utf-8");
}

async function readAllScenes(): Promise<SceneRecord[]> {
  try {
    const col = await getCollection(COLLECTIONS.scenes);
    if (col) {
      const count = await col.countDocuments();
      if (count === 0) {
        const defaults = defaultScenes();
        await mongoInsertMany(COLLECTIONS.scenes, defaults);
        return defaults;
      }
      const docs = await col.find({}).toArray();
      return docs.map(({ _id, ...rest }) => rest as SceneRecord);
    }
  } catch (err) {
    console.warn("[scenes] MongoDB read failed:", (err as Error).message);
    if (isVercelRuntime()) {
      throw new MongoUnavailableError(
        `MongoDB scene read failed on Vercel (${(err as Error).message}). JSON fallback is disabled.`
      );
    }
  }
  if (isVercelRuntime()) {
    console.error(
      `[scenes] Mongo unavailable (${getMongoUnavailableReason()}) — refusing JSON write; returning read-only fallback`
    );
  } else {
    console.warn("[scenes] Mongo unavailable — using JSON file fallback");
  }
  return readJsonScenes();
}

export async function ensureRegistry(): Promise<SceneRegistry> {
  return { scenes: await readAllScenes() };
}

export async function readRegistry(): Promise<SceneRegistry> {
  return ensureRegistry();
}

export async function writeRegistry(registry: SceneRegistry): Promise<void> {
  const col = await getCollection(COLLECTIONS.scenes);
  if (col) {
    await col.deleteMany({});
    if (registry.scenes.length > 0) {
      await mongoInsertMany(COLLECTIONS.scenes, registry.scenes);
    }
    return;
  }
  assertJsonWriteAllowed("data/scenes.json");
  await writeJsonScenes(registry.scenes);
}

export function toSceneConfig(record: SceneRecord): SceneConfig {
  const { thumbnail: _t, createdAt: _c, published: _p, ...config } = record;
  return config;
}

export async function getSceneById(id: string): Promise<SceneRecord | undefined> {
  const col = await getCollection<SceneRecord>(COLLECTIONS.scenes);
  if (col) {
    const doc = await col.findOne({ id, published: true });
    if (doc) {
      const { _id, ...rest } = doc as unknown as SceneRecord & { _id?: string };
      return rest;
    }
    return undefined;
  }
  const scenes = await readJsonScenes();
  return scenes.find((s) => s.id === id && s.published);
}

export async function getSceneRecordById(id: string): Promise<SceneRecord | undefined> {
  const col = await getCollection(COLLECTIONS.scenes);
  if (col) {
    const doc = await col.findOne({ id });
    if (doc) {
      const { _id, ...rest } = doc as unknown as SceneRecord & { _id?: string };
      return rest;
    }
    return undefined;
  }
  const scenes = await readJsonScenes();
  return scenes.find((s) => s.id === id);
}

export async function getSceneConfigById(id: string): Promise<SceneConfig | undefined> {
  const scene = await getSceneById(id);
  return scene ? toSceneConfig(scene) : undefined;
}

export async function listPublicScenes(): Promise<SceneRecord[]> {
  const scenes = await readAllScenes();
  return scenes.filter((s) => s.published);
}

export async function listScenesByCategory(category: RoomCategory): Promise<SceneRecord[]> {
  const scenes = await listPublicScenes();
  return scenes.filter((s) => s.category === category);
}

export async function listAllScenes(): Promise<SceneRecord[]> {
  return readAllScenes();
}

export function buildZoneConfigs(
  sceneId: string,
  zones: { id: string; label: string; palette: ZonePalette }[],
  /** Public URL prefix — `/scenes/<id>` locally or R2 `https://…/scenes/<id>` on Vercel. */
  assetBase?: string
): SceneZoneConfig[] {
  const base = (assetBase ?? `/scenes/${sceneId}`).replace(/\/$/, "");
  return zones.map((z, i) => {
    const meta = ZONE_META[z.id];
    const palette = z.palette;
    return {
      id: z.id,
      label: z.label,
      palette,
      zoneGroup:
        meta?.zoneGroup ??
        (palette === "wood" ? "wood" : palette === "tile" ? "tile" : "surface"),
      zIndex: meta?.zIndex ?? (palette === "wood" ? i + 10 : i + 1),
      glossyHighlight: meta?.glossyHighlight ?? palette === "wood",
      maskPath: `${base}/mask-${z.id}.png`,
    };
  });
}

export async function addScene(record: SceneRecord): Promise<void> {
  const col = await getCollection(COLLECTIONS.scenes);
  if (col) {
    // Never $set _id on existing docs (immutable); only set on insert.
    await col.updateOne(
      { id: record.id },
      { $set: { ...record }, $setOnInsert: { _id: record.id } },
      { upsert: true }
    );
    console.log(`[scenes] Saved scene "${record.id}" to MongoDB`);
    return;
  }
  if (isVercelRuntime()) {
    throw new MongoUnavailableError(
      `Cannot save scene metadata on Vercel without MongoDB (${getMongoUnavailableReason()}). Check MONGODB_URI / MONGODB_DB_NAME and Atlas Network Access.`
    );
  }
  const scenes = await readJsonScenes();
  const idx = scenes.findIndex((s) => s.id === record.id);
  if (idx >= 0) scenes[idx] = record;
  else scenes.push(record);
  await writeJsonScenes(scenes);
}

export async function deleteScene(id: string): Promise<boolean> {
  const col = await getCollection(COLLECTIONS.scenes);
  if (col) {
    const result = await col.deleteOne({ id });
    return result.deletedCount > 0;
  }
  if (isVercelRuntime()) {
    throw new MongoUnavailableError(
      `Cannot delete scene on Vercel without MongoDB (${getMongoUnavailableReason()}).`
    );
  }
  const scenes = await readJsonScenes();
  const filtered = scenes.filter((s) => s.id !== id);
  if (filtered.length === scenes.length) return false;
  await writeJsonScenes(filtered);
  return true;
}

export function getSceneDir(sceneId: string): string {
  return getSceneWorkDir(sceneId);
}

export function slugifyZoneId(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "zone"
  );
}
