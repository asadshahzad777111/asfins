import sharp from "sharp";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import {
  detectAlphaPolarity,
  isMaskPixelInside,
  layerHasAlphaVariation,
} from "@/lib/images/mask-alpha";
import { parseTransparentRegions, buildZoneMaskPixels } from "@/lib/images/region-labeler";

/** Pixels at or below this max(R,G,B) are treated as black background. */
export const BLACK_THRESHOLD = 25;
export const LUM_THRESHOLD = 22;
export const ALPHA_MIN = 12;

export function isLayerBackground(
  lr: number,
  lg: number,
  lb: number,
  la: number
): boolean {
  if (la < ALPHA_MIN) return true;
  const maxC = Math.max(lr, lg, lb);
  const lum = 0.299 * lr + 0.587 * lg + 0.114 * lb;
  return maxC <= BLACK_THRESHOLD && lum <= LUM_THRESHOLD;
}

function erode(binary: Uint8Array, W: number, H: number, radius = 1): Uint8Array {
  const out = new Uint8Array(binary.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!binary[i]) continue;
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy++) {
        for (let dx = -radius; dx <= radius && keep; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) {
            keep = false;
            break;
          }
          if (!binary[ny * W + nx]) keep = false;
        }
      }
      if (keep) out[i] = 1;
    }
  }
  return out;
}

function dilate(binary: Uint8Array, W: number, H: number, radius = 1): Uint8Array {
  const out = new Uint8Array(binary.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (binary[i]) {
        out[i] = 1;
        continue;
      }
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (binary[ny * W + nx]) {
            out[i] = 1;
            break;
          }
        }
        if (out[i]) break;
      }
    }
  }
  return out;
}

export function morphOpen(binary: Uint8Array, W: number, H: number, radius = 1): Uint8Array {
  return dilate(erode(binary, W, H, radius), W, H, radius);
}

export function morphClose(binary: Uint8Array, W: number, H: number, radius = 1): Uint8Array {
  return erode(dilate(binary, W, H, radius), W, H, radius);
}

export interface MaskStats {
  width: number;
  height: number;
  totalPixels: number;
  activePixels: number;
  activePercent: number;
  avgLuminance: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } | null;
  looksFullImage: boolean;
  looksReasonable: boolean;
}

export function analyzeMaskBuffer(maskRaw: Buffer, W: number, H: number): MaskStats {
  let active = 0;
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  let sumLum = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = maskRaw[i];
      const g = maskRaw[i + 1];
      const b = maskRaw[i + 2];
      const a = maskRaw[i + 3];
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      if (lum > 10 && a > 10) {
        active++;
        sumLum += lum;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const total = W * H;
  const pct = total > 0 ? (active / total) * 100 : 0;
  const hasBounds = active > 0;

  return {
    width: W,
    height: H,
    totalPixels: total,
    activePixels: active,
    activePercent: Math.round(pct * 100) / 100,
    avgLuminance: active > 0 ? Math.round(sumLum / active) : 0,
    bounds: hasBounds
      ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
    looksFullImage: pct > 60,
    looksReasonable: pct >= 5 && pct <= 45,
  };
}

export interface LayerStats {
  foregroundPixels: number;
  foregroundPercent: number;
  nearBlackNoisePixels: number;
  looksFullImage: boolean;
  hint: string | null;
}

export function analyzeLayerBuffer(layerRaw: Buffer, W: number, H: number): LayerStats {
  let foreground = 0;
  let nearBlackNoise = 0;

  for (let i = 0; i < W * H; i++) {
    const li = i * 4;
    const lr = layerRaw[li];
    const lg = layerRaw[li + 1];
    const lb = layerRaw[li + 2];
    const la = layerRaw[li + 3];
    if (isLayerBackground(lr, lg, lb, la)) {
      const maxC = Math.max(lr, lg, lb);
      if (maxC > 0 && maxC <= BLACK_THRESHOLD) nearBlackNoise++;
    } else {
      foreground++;
    }
  }

  const total = W * H;
  const fgPct = total > 0 ? (foreground / total) * 100 : 0;

  return {
    foregroundPixels: foreground,
    foregroundPercent: Math.round(fgPct * 100) / 100,
    nearBlackNoisePixels: nearBlackNoise,
    looksFullImage: fgPct > 60,
    hint:
      fgPct > 60
        ? "Layer covers most of the image — use a cutout on pure black, not the full photo."
        : fgPct < 3
          ? "Layer has almost no cabinet pixels — check the cutout file."
          : null,
  };
}

/** PNG with transparent background (cabinet cutout) — use alpha, not black-pixel rules. */
function layerUsesAlphaCutout(layerRaw: Buffer, W: number, H: number): boolean {
  return layerHasAlphaVariation(layerRaw, W * H);
}

function buildMaskPixels(
  baseRaw: Buffer,
  layerRaw: Buffer,
  W: number,
  H: number
): Buffer {
  const binary = new Uint8Array(W * H);
  const alphaCutout = layerUsesAlphaCutout(layerRaw, W, H);
  const polarity = alphaCutout ? detectAlphaPolarity(layerRaw, W * H) : null;

  for (let i = 0; i < W * H; i++) {
    const li = i * 4;
    if (alphaCutout && polarity) {
      binary[i] = isMaskPixelInside(layerRaw[li + 3], polarity) ? 1 : 0;
    } else {
      binary[i] = isLayerBackground(
        layerRaw[li],
        layerRaw[li + 1],
        layerRaw[li + 2],
        layerRaw[li + 3]
      )
        ? 0
        : 1;
    }
  }

  const opened = morphOpen(binary, W, H, 1);
  const cleaned = morphClose(opened, W, H, 1);

  const mask = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const mi = i * 4;
    if (!cleaned[i]) {
      mask[mi] = mask[mi + 1] = mask[mi + 2] = mask[mi + 3] = 0;
      continue;
    }
    // Opaque white = recolor zone; fully transparent = ignore (engine uses alpha).
    mask[mi] = mask[mi + 1] = mask[mi + 2] = 255;
    mask[mi + 3] = 255;
  }

  return mask;
}

/**
 * Normalize a user-uploaded mask PNG to alpha-cutout format:
 * transparent = skip, opaque white = apply colour.
 */
export async function normalizeDirectMask(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const raw = await sharp(input).ensureAlpha().raw().toBuffer();
  const out = Buffer.alloc(W * H * 4);
  const polarity = detectAlphaPolarity(raw, W * H);
  const useAlpha = layerHasAlphaVariation(raw, W * H);

  for (let i = 0; i < W * H; i++) {
    const pi = i * 4;
    const r = raw[pi];
    const g = raw[pi + 1];
    const b = raw[pi + 2];
    const a = raw[pi + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    let inside = false;
    if (useAlpha) {
      inside = isMaskPixelInside(a, polarity);
    } else {
      inside = lum >= 128;
    }

    if (!inside) {
      out[pi] = out[pi + 1] = out[pi + 2] = out[pi + 3] = 0;
    } else {
      out[pi] = out[pi + 1] = out[pi + 2] = out[pi + 3] = 255;
    }
  }

  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

export async function buildMaskFromLayer(
  basePath: string,
  layerPath: string,
  outPath: string
): Promise<{ width: number; height: number; stats: MaskStats; layerStats: LayerStats }> {
  const baseMeta = await sharp(basePath).metadata();
  const layerMeta = await sharp(layerPath).metadata();
  const W = baseMeta.width!;
  const H = baseMeta.height!;

  if (layerMeta.width !== W || layerMeta.height !== H) {
    console.warn(
      `[mask] Layer ${layerMeta.width}x${layerMeta.height} resized to match base ${W}x${H}`
    );
  }

  const baseRaw = await sharp(basePath)
    .resize(W, H)
    .ensureAlpha()
    .raw()
    .toBuffer();
  const layerRaw = await sharp(layerPath)
    .resize(W, H)
    .ensureAlpha()
    .raw()
    .toBuffer();

  const layerStats = analyzeLayerBuffer(layerRaw, W, H);
  const alphaCutout = layerUsesAlphaCutout(layerRaw, W, H);
  const mask = buildMaskPixels(baseRaw, layerRaw, W, H);
  const stats = analyzeMaskBuffer(mask, W, H);

  await sharp(mask, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(outPath);

  if (alphaCutout) {
    console.log(`[mask] ${path.basename(outPath)}: alpha PNG cutout → ${stats.activePercent}%`);
  }

  return { width: W, height: H, stats, layerStats };
}

export async function createMinimalOverlays(
  sceneDir: string,
  width: number,
  height: number
): Promise<void> {
  const highlight = Buffer.from(
    `<svg width="${width}" height="${height}"><ellipse cx="${width * 0.5}" cy="${height * 0.35}" rx="${width * 0.25}" ry="${height * 0.12}" fill="white" opacity="0.2"/></svg>`
  );
  await sharp(highlight)
    .png()
    .toFile(path.join(sceneDir, "highlight-gloss.png"));

  const glow = Buffer.from(
    `<svg width="${width}" height="${height}"><radialGradient id="g"><stop offset="0%" stop-color="#ffb870" stop-opacity="0.6"/><stop offset="100%" stop-color="#ffb870" stop-opacity="0"/></radialGradient><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(glow).png().toFile(path.join(sceneDir, "night-glow.png"));
}

export async function ensureBaseJpeg(
  sceneDir: string,
  baseFilename: string
): Promise<string> {
  const baseJpg = path.join(sceneDir, "base.jpg");
  const ext = path.extname(baseFilename).toLowerCase();
  const baseSrc = path.join(sceneDir, baseFilename);

  if (ext === ".png") {
    await sharp(baseSrc).jpeg({ quality: 92 }).toFile(baseJpg);
  } else if (ext === ".jpg" || ext === ".jpeg") {
    await sharp(baseSrc).jpeg({ quality: 92 }).toFile(baseJpg);
  }

  return baseJpg;
}

export async function processSceneMasks(
  sceneDir: string,
  zoneIds: string[]
): Promise<{ width: number; height: number }> {
  await mkdir(sceneDir, { recursive: true });
  const baseJpg = path.join(sceneDir, "base.jpg");

  let width = 0;
  let height = 0;

  for (const zoneId of zoneIds) {
    const layerPath = path.join(sceneDir, `layer-${zoneId}.png`);
    const maskPath = path.join(sceneDir, `mask-${zoneId}.png`);
    const result = await buildMaskFromLayer(baseJpg, layerPath, maskPath);
    width = result.width;
    height = result.height;

    console.log(`[mask] ${zoneId}: ${result.stats.activePercent}% active pixels`);
    if (result.layerStats.hint) {
      console.warn(`[mask] ${zoneId}: ${result.layerStats.hint}`);
    }
    if (result.stats.looksFullImage) {
      console.warn(
        `[mask] ${zoneId}: mask covers ${result.stats.activePercent}% — likely bad layer cutout`
      );
    }
  }

  if (width === 0 || height === 0) {
    const meta = await sharp(baseJpg).metadata();
    width = meta.width ?? 1200;
    height = meta.height ?? 800;
  }

  if (width > 0 && height > 0) {
    await createMinimalOverlays(sceneDir, width, height);
  }

  return { width, height };
}

export function slugifySceneId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "kitchen";
}

export type RegionMappings = Record<string, number[]>;

/**
 * Parse a master cutout PNG and generate per-zone masks from region assignments.
 */
export async function buildMasksFromRegionMappings(
  masterCutoutPath: string,
  sceneDir: string,
  mappings: RegionMappings
): Promise<{ width: number; height: number; regionCount: number }> {
  const meta = await sharp(masterCutoutPath).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const raw = await sharp(masterCutoutPath).ensureAlpha().raw().toBuffer();
  const parsed = parseTransparentRegions(raw, W, H);

  for (const [zoneId, regionIds] of Object.entries(mappings)) {
    if (!regionIds.length) continue;
    const maskPixels = buildZoneMaskPixels(W, H, parsed.regionMap, regionIds);
    const maskPath = path.join(sceneDir, `mask-${zoneId}.png`);
    await sharp(Buffer.from(maskPixels.buffer), {
      raw: { width: W, height: H, channels: 4 },
    })
      .png()
      .toFile(maskPath);
    console.log(`[mask] ${zoneId}: regions [${regionIds.join(",")}] → ${maskPath}`);
  }

  const mappingsPath = path.join(sceneDir, "region-mappings.json");
  await writeFile(mappingsPath, JSON.stringify(mappings, null, 2), "utf-8");

  return { width: W, height: H, regionCount: parsed.regions.length };
}
