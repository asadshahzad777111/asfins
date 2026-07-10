import sharp from "sharp";
import { access } from "fs/promises";
import { computeMaskBinary } from "@/lib/scenes/process-masks";

/**
 * Merge N per-zone cutout PNGs (each the same size as the base photo, with transparency only
 * in that one zone's shape) into a single combined "master cutout": wherever ANY input layer's
 * zone-hole covers a pixel, the merged output is transparent there; everywhere else it's the
 * base photo's own pixels, opaque. This reproduces exactly what an admin would get from manually
 * cutting every zone transparent in one combined image — so the existing renderer (`engine.ts`'s
 * `resolveCutoutImage`) can consume it unchanged as `cutout.png`.
 */
export async function mergeCutoutLayers(
  basePhotoPath: string,
  layerPaths: string[],
  outPath: string
): Promise<{ width: number; height: number; holePercent: number }> {
  const baseMeta = await sharp(basePhotoPath).metadata();
  const W = baseMeta.width!;
  const H = baseMeta.height!;
  const baseRaw = await sharp(basePhotoPath).resize(W, H).ensureAlpha().raw().toBuffer();

  const hole = new Uint8Array(W * H);
  for (const layerPath of layerPaths) {
    const layerRaw = await sharp(layerPath).resize(W, H).ensureAlpha().raw().toBuffer();
    const binary = computeMaskBinary(baseRaw, layerRaw, W, H);
    for (let i = 0; i < W * H; i++) {
      if (binary[i]) hole[i] = 1;
    }
  }

  const out = Buffer.alloc(W * H * 4);
  let holeCount = 0;
  for (let i = 0; i < W * H; i++) {
    const oi = i * 4;
    if (hole[i]) {
      out[oi] = out[oi + 1] = out[oi + 2] = out[oi + 3] = 0;
      holeCount++;
    } else {
      out[oi] = baseRaw[oi];
      out[oi + 1] = baseRaw[oi + 1];
      out[oi + 2] = baseRaw[oi + 2];
      out[oi + 3] = 255;
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outPath);

  const total = W * H;
  return {
    width: W,
    height: H,
    holePercent: total > 0 ? Math.round((holeCount / total) * 10000) / 100 : 0,
  };
}

/**
 * Build a combined cutout from already-normalized zone masks (opaque white = zone).
 * Useful when editing a scene that only has mask-*.png on disk (no layer-*.png left).
 */
export async function mergeCutoutFromMasks(
  basePhotoPath: string,
  maskPaths: string[],
  outPath: string
): Promise<{ width: number; height: number; holePercent: number }> {
  const baseMeta = await sharp(basePhotoPath).metadata();
  const W = baseMeta.width!;
  const H = baseMeta.height!;
  const baseRaw = await sharp(basePhotoPath).resize(W, H).ensureAlpha().raw().toBuffer();

  const hole = new Uint8Array(W * H);
  for (const maskPath of maskPaths) {
    const maskRaw = await sharp(maskPath).resize(W, H).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < W * H; i++) {
      const mi = i * 4;
      const a = maskRaw[mi + 3];
      const lum = 0.299 * maskRaw[mi] + 0.587 * maskRaw[mi + 1] + 0.114 * maskRaw[mi + 2];
      if (a > 10 && lum > 10) hole[i] = 1;
    }
  }

  const out = Buffer.alloc(W * H * 4);
  let holeCount = 0;
  for (let i = 0; i < W * H; i++) {
    const oi = i * 4;
    if (hole[i]) {
      out[oi] = out[oi + 1] = out[oi + 2] = out[oi + 3] = 0;
      holeCount++;
    } else {
      out[oi] = baseRaw[oi];
      out[oi + 1] = baseRaw[oi + 1];
      out[oi + 2] = baseRaw[oi + 2];
      out[oi + 3] = 255;
    }
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outPath);

  const total = W * H;
  return {
    width: W,
    height: H,
    holePercent: total > 0 ? Math.round((holeCount / total) * 10000) / 100 : 0,
  };
}

export async function filterExistingPaths(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    try {
      await access(p);
      out.push(p);
    } catch {
      // Skip missing files.
    }
  }
  return out;
}
