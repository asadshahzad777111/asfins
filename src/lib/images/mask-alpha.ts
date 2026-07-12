/** How alpha encodes the recolour zone in a PNG mask/layer. */
export type AlphaPolarity = "opaque-zone" | "transparent-zone";

const ALPHA_CUTOFF = 128;
/** Above this transparent fraction → treat opaque pixels as the zone (cutout on clear bg).
 *  Keep high enough that large full-photo holes (e.g. a wall ~50% of frame) still count as
 *  transparent-zone (Photopea-style erase). Typical clear-bg cutouts are 70%+ transparent. */
const TRANSPARENT_MAJORITY = 0.55;

/**
 * Detect mask encoding from alpha histogram.
 * - Mostly transparent canvas → opaque pixels are cabinets (cutout on clear bg).
 * - Mostly opaque photo with holes → transparent pixels are cabinets (Photopea erase).
 * - Pipeline-baked masks (opaque white = zone) → always opaque-zone, even when the
 *   zone is ~50% of the frame (transparent fraction alone is ambiguous there).
 */
export function detectAlphaPolarity(
  data: Uint8ClampedArray | Uint8Array,
  pixelCount?: number
): AlphaPolarity {
  const total = pixelCount ?? data.length / 4;
  let transparent = 0;
  let opaqueWhite = 0;
  let opaqueOther = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < ALPHA_CUTOFF) {
      transparent++;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 200 && g > 200 && b > 200) opaqueWhite++;
    else opaqueOther++;
  }
  // Baked mask-*.png from process-masks: opaque white = recolour zone.
  if (opaqueWhite > opaqueOther * 3 && opaqueWhite > total * 0.02) {
    return "opaque-zone";
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
