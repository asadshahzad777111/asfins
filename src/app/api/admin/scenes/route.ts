import { writeFile, mkdir, unlink, copyFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  addScene,
  buildZoneConfigs,
  getSceneDir,
  getSceneRecordById,
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
import {
  filterExistingPaths,
  mergeCutoutFromMasks,
  mergeCutoutLayers,
} from "@/lib/images/merge-cutouts";
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

function validPalette(palette: string): ZonePalette {
  return palette === "paint" ? "paint" : palette === "tile" ? "tile" : "wood";
}

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

async function tryUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // ignore missing files
  }
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

  try {
    return await handleScenePost(form);
  } catch (err) {
    console.error("[admin/scenes] POST failed:", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Scene save failed — check cutout PNGs and try again";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleScenePost(form: FormData): Promise<NextResponse> {
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const requestedId = String(form.get("id") ?? "").trim();
  const category = String(form.get("category") ?? "kitchen") as RoomCategory;
  const catalogIdsRaw = String(form.get("catalogIds") ?? "");
  const wizardModeRaw = String(form.get("wizardMode") ?? "");
  const wizardMode = wizardModeRaw === "region";
  const simpleMode = wizardModeRaw === "simple";

  if (!name) {
    return NextResponse.json({ error: "Scene name is required" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid room category" }, { status: 400 });
  }

  // Editing an existing scene (same id) reuses whatever files aren't replaced —
  // sceneDir is deterministic from the id, so anything we don't rewrite below
  // is simply left in place from the previous save.
  const existingRecord = requestedId ? await getSceneRecordById(requestedId) : undefined;

  let baseImage: { buffer: Buffer; ext: string } | null;
  try {
    baseImage = await resolveImageBuffer(form, "basePhoto", "basePhotoUrl", ".jpg");
    if (!baseImage && !existingRecord) {
      return NextResponse.json({ error: "Kitchen photo (base) is required" }, { status: 400 });
    }
  } catch (err) {
    const message =
      err instanceof ImageFetchError ? err.message : "Could not load base photo";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const zoneCount = Number(form.get("zoneCount") ?? 0);
  const uploadedZones: { id: string; label: string; palette: ZonePalette; index: number }[] =
    [];
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
      const palette = String(form.get(`zone_${i}_palette`) ?? "wood");
      const zoneId = String(form.get(`zone_${i}_id`) ?? "").trim();
      if (!zoneId || !label) continue;
      const regionIds = regionMappings[zoneId];
      if (!regionIds?.length) continue;
      uploadedZones.push({ id: zoneId, label, palette: validPalette(palette), index: i });
    }
  } else if (simpleMode) {
    for (let i = 0; i < zoneCount; i++) {
      const label = String(form.get(`zone_${i}_label`) ?? "").trim();
      const palette = String(form.get(`zone_${i}_palette`) ?? "wood");
      const presetId = String(form.get(`zone_${i}_id`) ?? "").trim();
      const keepExisting = form.get(`zone_${i}_keepExisting`) === "true";
      if (!label) continue;

      const layerFile = form.get(`zone_${i}_file`);
      const layerUrl = String(form.get(`zone_${i}_fileUrl`) ?? "").trim();
      const hasLayer =
        (layerFile instanceof File && layerFile.size > 0) || Boolean(layerUrl);

      if (!hasLayer && !keepExisting) continue;

      let zoneId = presetId || slugifyZoneId(label);
      if (uploadedZones.find((z) => z.id === zoneId)) zoneId = `${zoneId}-${i}`;

      uploadedZones.push({ id: zoneId, label, palette: validPalette(palette), index: i });
    }
  } else {
    for (let i = 0; i < zoneCount; i++) {
      const label = String(form.get(`zone_${i}_label`) ?? "").trim();
      const palette = String(form.get(`zone_${i}_palette`) ?? "wood");
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
      if (uploadedZones.find((z) => z.id === zoneId)) zoneId = `${zoneId}-${i}`;

      uploadedZones.push({ id: zoneId, label, palette: validPalette(palette), index: i });
    }
  }

  if (uploadedZones.length === 0) {
    return NextResponse.json(
      {
        error: wizardMode
          ? "Map at least one zone to a transparent region"
          : "Upload at least one zone cutout PNG (floor, wall, or cabinets)",
      },
      { status: 400 }
    );
  }

  const sceneId = requestedId || slugifySceneId(name);
  const sceneDir = getSceneDir(sceneId);
  await mkdir(sceneDir, { recursive: true });

  // Drop zones the admin removed in the simple editor.
  const removedRaw = String(form.get("removedZoneIds") ?? "");
  const removedIds = removedRaw
    ? removedRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  for (const rid of removedIds) {
    await tryUnlink(path.join(sceneDir, `layer-${rid}.png`));
    await tryUnlink(path.join(sceneDir, `mask-${rid}.png`));
  }

  const baseFilename = baseImage
    ? `base${baseImage.ext === ".png" ? ".png" : ".jpg"}`
    : existingRecord!.basePhoto.endsWith(".png")
      ? "base.png"
      : "base.jpg";
  if (baseImage) {
    await writeFile(path.join(sceneDir, baseFilename), baseImage.buffer);
  }

  const zonesNeedingMaskGen: string[] = [];
  let width = 0;
  let height = 0;

  if (wizardMode && regionMappings) {
    let masterCutout: { buffer: Buffer; ext: string } | null;
    try {
      masterCutout = await resolveImageBuffer(form, "masterCutout", "masterCutoutUrl", ".png");
      if (!masterCutout && !existingRecord?.regionMappings) {
        return NextResponse.json({ error: "Master cutout PNG is required" }, { status: 400 });
      }
    } catch (err) {
      const message =
        err instanceof ImageFetchError ? err.message : "Could not load master cutout";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const masterPath = path.join(sceneDir, "master-cutout.png");
    if (masterCutout) {
      await writeFile(masterPath, masterCutout.buffer);
    }

    // Masks are always rebuilt from regionMappings — even when the cutout PNG
    // itself is reused unchanged, the admin may have re-mapped zones.
    const maskResult = await buildMasksFromRegionMappings(
      masterPath,
      sceneDir,
      regionMappings
    );
    width = maskResult.width;
    height = maskResult.height;
  } else if (simpleMode) {
    for (const zone of uploadedZones) {
      const i = zone.index;
      const keepExisting = form.get(`zone_${i}_keepExisting`) === "true";

      try {
        const layer = await resolveImageBuffer(
          form,
          `zone_${i}_file`,
          `zone_${i}_fileUrl`,
          ".png"
        );
        if (layer) {
          await writeFile(path.join(sceneDir, `layer-${zone.id}.png`), layer.buffer);
          zonesNeedingMaskGen.push(zone.id);
        } else if (keepExisting) {
          // Reuse existing mask/layer on disk — nothing to write.
        } else {
          return NextResponse.json(
            { error: `Missing cutout PNG for ${zone.label}` },
            { status: 400 }
          );
        }
      } catch (err) {
        const message =
          err instanceof ImageFetchError
            ? `${zone.label}: ${err.message}`
            : `Could not load image for ${zone.label}`;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
  } else {
    for (const zone of uploadedZones) {
      const i = zone.index;
      const useDirectMask = form.get(`zone_${i}_useDirectMask`) === "true";

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
  const baseJpg = path.join(sceneDir, "base.jpg");

  if (!wizardMode) {
    const maskDimensions = await processSceneMasks(sceneDir, zonesNeedingMaskGen);
    width = maskDimensions.width;
    height = maskDimensions.height;

    if (simpleMode) {
      // Prefer merging from per-zone layer cutouts; fall back to masks for kept zones.
      const layerPaths = await filterExistingPaths(
        uploadedZones.map((z) => path.join(sceneDir, `layer-${z.id}.png`))
      );
      const cutoutPath = path.join(sceneDir, "cutout.png");
      if (layerPaths.length > 0) {
        const merged = await mergeCutoutLayers(baseJpg, layerPaths, cutoutPath);
        width = merged.width;
        height = merged.height;
        console.log(`[cutout] merged ${layerPaths.length} layers → ${merged.holePercent}% holes`);
      } else {
        const maskPaths = await filterExistingPaths(
          uploadedZones.map((z) => path.join(sceneDir, `mask-${z.id}.png`))
        );
        if (maskPaths.length > 0) {
          const merged = await mergeCutoutFromMasks(baseJpg, maskPaths, cutoutPath);
          width = merged.width;
          height = merged.height;
          console.log(`[cutout] merged ${maskPaths.length} masks → ${merged.holePercent}% holes`);
        }
      }
      // Also write master-cutout.png so advanced re-edit can find something familiar.
      try {
        await copyFile(cutoutPath, path.join(sceneDir, "master-cutout.png"));
      } catch {
        // cutout may be missing if no layers/masks — ignore
      }
    }
  } else if (width > 0 && height > 0) {
    await createMinimalOverlays(sceneDir, width, height);
  } else {
    const meta = await sharp(baseJpg).metadata();
    width = meta.width ?? 1200;
    height = meta.height ?? 800;
    await createMinimalOverlays(sceneDir, width, height);
  }

  const thumbPath = path.join(sceneDir, "thumb.jpg");
  await sharp(baseJpg)
    .resize(400, 300, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  const assetBase = `/scenes/${sceneId}`;
  const catalogIds = catalogIdsRaw
    ? catalogIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["artisan-laminates", "greenply", "local-paint", "zrk-group"];

  const basePhotoPath = baseImage
    ? baseImage.ext === ".png"
      ? `${assetBase}/base.png`
      : `${assetBase}/base.jpg`
    : existingRecord!.basePhoto;

  // Simple mode drops regionMappings so studio only sees the uploaded zones.
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
    zones: buildZoneConfigs(
      sceneId,
      uploadedZones.map(({ id, label, palette }) => ({ id, label, palette }))
    ),
    catalogIds,
    createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
    published: true,
    ...(wizardMode && regionMappings ? { regionMappings } : {}),
  };

  // When switching from advanced→simple edit, clear stale regionMappings.
  if (simpleMode && existingRecord?.regionMappings) {
    delete (record as { regionMappings?: RegionMappings }).regionMappings;
  }

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
