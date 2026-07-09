/** How alpha encodes the recolour zone in a PNG mask/layer. */
export type AlphaPolarity = "opaque-zone" | "transparent-zone";

const ALPHA_CUTOFF = 128;
const TRANSPARENT_MAJORITY = 0.45;

/**
 * Detect mask encoding from alpha histogram.
 * - Mostly transparent canvas → opaque pixels are cabinets (cutout on clear bg).
 * - Mostly opaque photo with holes → transparent pixels are cabinets (Photopea erase).
 */
export function detectAlphaPolarity(
  data: Uint8ClampedArray | Uint8Array,
  pixelCount?: number
): AlphaPolarity {
  const total = pixelCount ?? data.length / 4;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < ALPHA_CUTOFF) transparent++;
  }
  return transparent / total > TRANSPARENT_MAJORITY ? "opaque-zone" : "transparent-zone";
}

export function layerHasAlphaVariation(
  data: Uint8ClampedArray | Uint8Array,
  pixelCount?: number
): boolean {
  const total = pixelCount ?? data.length / 4;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) transparent++;
  }
  return transparent / total > 0.02;
}

/** True when this pixel is inside the recolour zone. */
export function isMaskPixelInside(
  a: number,
  polarity: AlphaPolarity
): boolean {
  if (polarity === "opaque-zone") return a >= ALPHA_CUTOFF;
  return a < ALPHA_CUTOFF;
}
