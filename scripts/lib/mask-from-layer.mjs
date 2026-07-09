/**
 * Shared layer → mask conversion (used by CLI scripts).
 * Keep in sync with src/lib/scenes/process-masks.ts
 */

/** Pixels at or below this max(R,G,B) are treated as black background. */
export const BLACK_THRESHOLD = 25;
/** Luminance floor — both max channel and lum must exceed thresholds. */
export const LUM_THRESHOLD = 22;
/** Fully transparent layer pixels are always background. */
export const ALPHA_MIN = 12;

export function isLayerBackground(lr, lg, lb, la) {
  if (la < ALPHA_MIN) return true;
  const maxC = Math.max(lr, lg, lb);
  const lum = 0.299 * lr + 0.587 * lg + 0.114 * lb;
  return maxC <= BLACK_THRESHOLD && lum <= LUM_THRESHOLD;
}

export function layerUsesAlphaCutout(layerRaw, W, H) {
  let transparent = 0;
  for (let i = 0; i < W * H; i++) {
    if (layerRaw[i * 4 + 3] < 250) transparent++;
  }
  return transparent / (W * H) > 0.02;
}

function erode(binary, W, H, radius = 1) {
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

function dilate(binary, W, H, radius = 1) {
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

/** Opening: erode then dilate — removes fringe halos and speckle noise. */
export function morphOpen(binary, W, H, radius = 1) {
  return dilate(erode(binary, W, H, radius), W, H, radius);
}

/** Closing: dilate then erode — fills small holes inside cabinet shapes. */
export function morphClose(binary, W, H, radius = 1) {
  return erode(dilate(binary, W, H, radius), W, H, radius);
}

export function analyzeMaskBuffer(maskRaw, W, H) {
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

export function analyzeLayerBuffer(layerRaw, W, H) {
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

/**
 * Convert cabinet layer (black bg) → grayscale mask.
 * White = recolor zone; black/transparent = ignore.
 */
export function buildMaskPixels(baseRaw, layerRaw, W, H, { useBaseLuminance = true } = {}) {
  const binary = new Uint8Array(W * H);
  const alphaCutout = layerUsesAlphaCutout(layerRaw, W, H);
  let polarity = null;
  if (alphaCutout) {
    let transparent = 0;
    for (let i = 0; i < W * H; i++) {
      if (layerRaw[i * 4 + 3] < 128) transparent++;
    }
    polarity = transparent / (W * H) > 0.45 ? "opaque-zone" : "transparent-zone";
  }

  for (let i = 0; i < W * H; i++) {
    const li = i * 4;
    if (alphaCutout && polarity) {
      const a = layerRaw[li + 3];
      binary[i] =
        polarity === "opaque-zone" ? (a >= 128 ? 1 : 0) : a < 128 ? 1 : 0;
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
    if (useBaseLuminance) {
      const br = baseRaw[mi];
      const bg = baseRaw[mi + 1];
      const bb = baseRaw[mi + 2];
      const lum = Math.round(0.299 * br + 0.587 * bg + 0.114 * bb);
      mask[mi] = mask[mi + 1] = mask[mi + 2] = lum;
    } else {
      mask[mi] = mask[mi + 1] = mask[mi + 2] = 255;
    }
    mask[mi + 3] = 255;
  }

  return { mask, binary: cleaned };
}
