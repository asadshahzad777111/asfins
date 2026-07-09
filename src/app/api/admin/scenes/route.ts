import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  addScene,
  buildZoneConfigs,
  getSceneDir,
  listAllScenes,
  deleteScene,
  slugifyZoneId,
} from "@/lib/scenes/registry";
import {
  ensureBaseJpeg,
  normalizeDirectMask,
  processSceneMasks,
  buildMasksFromRegionMappings,
  createMinimalOverlays,
  slugifySceneId,
  type RegionMappings,
} from "@/lib/scenes/process-masks";
import { fetchImageFromUrl, ImageFetchError } from "@/lib/images/fetch-from-url";
import type { SceneRecord, RoomCategory, ZonePalette } from "@/lib/scenes/types";
import sharp from "sharp";

const VALID_CATEGORIES: RoomCategory[] = [
  "kitchen",
  "bathroom",
  "basement",
  "tv-lounge",
  "bedroom",
  "other",
];

async function resolveImageBuffer(
  form: FormData,
  fileKey: string,
  urlKey: string,
  defaultExt: string
): Promise<{ buffer: Buffer; ext: string } | null> {
  const file = form.get(fileKey);
  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.toLowerCase().endsWith(".png") ? ".png" : defaultExt;
    return { buffer, ext };
  }

  const url = String(form.get(urlKey) ?? "").trim();
  if (url) {
    try {
      const fetched = await fetchImageFromUrl(url);
      return { buffer: fetched.buffer, ext: fetched.ext };
    } catch (err) {
      const message =
        err instanceof ImageFetchError ? err.message : "Could not fetch image from URL";
      throw new ImageFetchError(message);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scenes = await listAllScenes();
  return NextResponse.json({ scenes });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const requestedId = String(form.get("id") ?? "").trim();
  const category = String(form.get("category") ?? "kitchen") as RoomCategory;
  const catalogIdsRaw = String(form.get("catalogIds") ?? "");
  const wizardMode = String(form.get("wizardMode") ?? "") === "region";

  if (!name) {
    return NextResponse.json({ error: "Scene name is required" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid room category" }, { status: 400 });
  }

  let baseImage: { buffer: Buffer; ext: string };
  try {
    const resolved = await resolveImageBuffer(form, "basePhoto", "basePhotoUrl", ".jpg");
    if (!resolved) {
      return NextResponse.json({ error: "Kitchen photo (base) is required" }, { status: 400 });
    }
    baseImage = resolved;
  } catch (err) {
    const message =
      err instanceof ImageFetchError ? err.message : "Could not load base photo";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const zoneCount = Number(form.get("zoneCount") ?? 0);
  const uploadedZones: { id: string; label: string; palette: ZonePalette }[] = [];
  let regionMappings: RegionMappings | undefined;

  if (wizardMode) {
    const mappingsRaw = String(form.get("regionMappings") ?? "{}");
    try {
      regionMappings = JSON.parse(mappingsRaw) as RegionMappings;
    } catch {
      return NextResponse.json({ error: "Invalid region mappings JSON" }, { status: 400 });
    }

    for (let i = 0; i < zoneCount; i++) {
      const label = String(form.get(`zone_${i}_label`) ?? "").trim();
      const palette = String(form.get(`zone_${i}_palette`) ?? "wood") as ZonePalette;
      const zoneId = String(form.get(`zone_${i}_id`) ?? "").trim();
      if (!zoneId || !label) continue;
      const regionIds = regionMappings[zoneId];
      if (!regionIds?.length) continue;

      const validPalette: ZonePalette =
        palette === "paint" ? "paint" : palette === "tile" ? "tile" : "wood";

      uploadedZones.push({ id: zoneId, label, palette: validPalette });
    }
  } else {
    for (let i = 0; i < zoneCount; i++) {
      const label = String(form.get(`zone_${i}_label`) ?? "").trim();
      const palette = String(form.get(`zone_${i}_palette`) ?? "wood") as ZonePalette;
      const useDirectMask = form.get(`zone_${i}_useDirectMask`) === "true";
      const presetId = String(form.get(`zone_${i}_id`) ?? "").trim();
      if (!label) continue;

      const layerFile = form.get(`zone_${i}_file`);
      const layerUrl = String(form.get(`zone_${i}_fileUrl`) ?? "").trim();
      const hasLayer =
        (layerFile instanceof File && layerFile.size > 0) || Boolean(layerUrl);

      const directMaskFile = form.get(`zone_${i}_directMask`);
      const directMaskUrl = String(form.get(`zone_${i}_directMaskUrl`) ?? "").trim();
      const hasDirect =
        (directMaskFile instanceof File && directMaskFile.size > 0) ||
        Boolean(directMaskUrl);

      if (!hasLayer && !hasDirect) continue;

      let zoneId = presetId || slugifyZoneId(label);
      const existing = uploadedZones.find((z) => z.id === zoneId);
      if (existing) zoneId = `${zoneId}-${i}`;

      const validPalette: ZonePalette =
        palette === "paint" ? "paint" : palette === "tile" ? "tile" : "wood";

      uploadedZones.push({ id: zoneId, label, palette: validPalette });
    }
  }

  if (uploadedZones.length === 0) {
    return NextResponse.json(
      {
        error: wizardMode
          ? "Map at least one zone to a transparent region"
          : "Upload at least one cabinet layer or mask (e.g. Cabinets Lakri)",
      },
      { status: 400 }
    );
  }

  const sceneId = requestedId || slugifySceneId(name);
  const sceneDir = getSceneDir(sceneId);
  await mkdir(sceneDir, { recursive: true });

  const baseFilename = `base${baseImage.ext === ".png" ? ".png" : ".jpg"}`;
  await writeFile(path.join(sceneDir, baseFilename), baseImage.buffer);

  const zonesNeedingMaskGen: string[] = [];
  let width = 0;
  let height = 0;

  if (wizardMode && regionMappings) {
    let masterCutout: { buffer: Buffer; ext: string };
    try {
      const resolved = await resolveImageBuffer(
        form,
        "masterCutout",
        "masterCutoutUrl",
        ".png"
      );
      if (!resolved) {
        return NextResponse.json({ error: "Master cutout PNG is required" }, { status: 400 });
      }
      masterCutout = resolved;
    } catch (err) {
      const message =
        err instanceof ImageFetchError ? err.message : "Could not load master cutout";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const masterPath = path.join(sceneDir, "master-cutout.png");
    await writeFile(masterPath, masterCutout.buffer);

    const maskResult = await buildMasksFromRegionMappings(
      masterPath,
      sceneDir,
      regionMappings
    );
    width = maskResult.width;
    height = maskResult.height;
  } else {
    for (let i = 0; i < zoneCount; i++) {
      const label = String(form.get(`zone_${i}_label`) ?? "").trim();
      const useDirectMask = form.get(`zone_${i}_useDirectMask`) === "true";
      if (!label) continue;

      const zone = uploadedZones.find(
        (z) => z.label === label || z.id === slugifyZoneId(label)
      );
      if (!zone) continue;

      try {
        if (useDirectMask) {
          const direct = await resolveImageBuffer(
            form,
            `zone_${i}_directMask`,
            `zone_${i}_directMaskUrl`,
            ".png"
          );
          if (direct) {
            const normalized = await normalizeDirectMask(direct.buffer);
            await writeFile(path.join(sceneDir, `mask-${zone.id}.png`), normalized);
          }
        } else {
          const layer = await resolveImageBuffer(
            form,
            `zone_${i}_file`,
            `zone_${i}_fileUrl`,
            ".png"
          );
          if (layer) {
            await writeFile(path.join(sceneDir, `layer-${zone.id}.png`), layer.buffer);
            zonesNeedingMaskGen.push(zone.id);
          }
        }
      } catch (err) {
        const message =
          err instanceof ImageFetchError
            ? `${zone.label}: ${err.message}`
            : `Could not load image for ${zone.label}`;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  }

  await ensureBaseJpeg(sceneDir, baseFilename);

  if (!wizardMode) {
    const maskDimensions = await processSceneMasks(sceneDir, zonesNeedingMaskGen);
    width = maskDimensions.width;
    height = maskDimensions.height;
  } else if (width > 0 && height > 0) {
    await createMinimalOverlays(sceneDir, width, height);
  } else {
    const meta = await sharp(path.join(sceneDir, "base.jpg")).metadata();
    width = meta.width ?? 1200;
    height = meta.height ?? 800;
    await createMinimalOverlays(sceneDir, width, height);
  }

  const thumbPath = path.join(sceneDir, "thumb.jpg");
  await sharp(path.join(sceneDir, "base.jpg"))
    .resize(400, 300, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  const assetBase = `/scenes/${sceneId}`;
  const catalogIds = catalogIdsRaw
    ? catalogIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["artisan-laminates", "greenply", "local-paint", "zrk-group"];

  const basePhotoPath =
    baseImage.ext === ".png" ? `${assetBase}/base.png` : `${assetBase}/base.jpg`;

  const record: SceneRecord = {
    id: sceneId,
    name,
    description: description || `${name} — apna colour choose karein`,
    category,
    width,
    height,
    thumbnail: `${assetBase}/thumb.jpg`,
    basePhoto: basePhotoPath,
    highlightMap: `${assetBase}/highlight-gloss.png`,
    nightGlow: `${assetBase}/night-glow.png`,
    zones: buildZoneConfigs(sceneId, uploadedZones),
    catalogIds,
    createdAt: new Date().toISOString(),
    published: true,
    ...(regionMappings ? { regionMappings } : {}),
  };

  await addScene(record);
  return NextResponse.json({ ok: true, scene: record }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Scene id required" }, { status: 400 });
  }

  const ok = await deleteScene(id);
  if (!ok) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
