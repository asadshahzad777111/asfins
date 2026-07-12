/**
 * Series → visual finish hints for texture application.
 * Blended with the global matt/glossy toggle — never replaces it.
 */

export type FinishHintId =
  | "uv-gloss"
  | "high-gloss-elite"
  | "syncron-premium"
  | "textured"
  | "lamination"
  | "default";

export interface SeriesFinishHint {
  id: FinishHintId;
  /** Extra RGB boost when finish mode is glossy (1 = none). */
  glossBoost: number;
  /** Scene highlight overlay strength when glossy (0–1). */
  highlightAlpha: number;
  /** Tile size multiplier (<1 = finer/more visible grain). */
  textureScale: number;
  /** Extra luminance contrast for grain feel (0 = off). */
  grainEmphasis: number;
  /** Mild sheen when user is on matt (still below full glossy). */
  mattSheen: number;
}

const HINTS: Record<FinishHintId, SeriesFinishHint> = {
  "uv-gloss": {
    id: "uv-gloss",
    glossBoost: 1.1,
    highlightAlpha: 0.42,
    textureScale: 1,
    grainEmphasis: 0.04,
    mattSheen: 1.02,
  },
  "high-gloss-elite": {
    id: "high-gloss-elite",
    glossBoost: 1.07,
    highlightAlpha: 0.32,
    textureScale: 1,
    grainEmphasis: 0.03,
    mattSheen: 1.015,
  },
  "syncron-premium": {
    id: "syncron-premium",
    glossBoost: 1.14,
    highlightAlpha: 0.5,
    textureScale: 0.96,
    grainEmphasis: 0.05,
    mattSheen: 1.03,
  },
  textured: {
    id: "textured",
    glossBoost: 1.03,
    highlightAlpha: 0.18,
    textureScale: 0.72,
    grainEmphasis: 0.14,
    mattSheen: 1,
  },
  lamination: {
    id: "lamination",
    glossBoost: 1.05,
    highlightAlpha: 0.28,
    textureScale: 1,
    grainEmphasis: 0.05,
    mattSheen: 1,
  },
  default: {
    id: "default",
    glossBoost: 1.06,
    highlightAlpha: 0.35,
    textureScale: 1,
    grainEmphasis: 0,
    mattSheen: 1,
  },
};

/** Resolve finish hint from series / materialCategory / surfaceFinish text. */
export function resolveFinishHint(
  seriesOrCategory?: string | null,
  surfaceFinish?: string | null
): SeriesFinishHint {
  const text = `${seriesOrCategory ?? ""} ${surfaceFinish ?? ""}`.toLowerCase();

  if (/syncron/.test(text) || /premium/.test(text)) {
    return HINTS["syncron-premium"];
  }
  if (/\buv\b/.test(text) || /uv\s*lux/.test(text)) {
    return HINTS["uv-gloss"];
  }
  if (/high\s*gloss\s*elite/.test(text)) {
    return HINTS["high-gloss-elite"];
  }
  if (/textured/.test(text)) {
    return HINTS.textured;
  }
  if (/lamination|patex\s*elegance|patex\s*lamination/.test(text)) {
    return HINTS.lamination;
  }
  if (/high\s*gloss/.test(text)) {
    return HINTS["high-gloss-elite"];
  }

  return HINTS.default;
}

export function finishHintFromSwatch(swatch: {
  materialCategory?: string;
  surfaceFinish?: string;
  finishHint?: FinishHintId | string;
}): SeriesFinishHint {
  if (swatch.finishHint && swatch.finishHint in HINTS) {
    return HINTS[swatch.finishHint as FinishHintId];
  }
  return resolveFinishHint(swatch.materialCategory, swatch.surfaceFinish);
}

/**
 * Effective per-pixel gloss multiplier for texture/color masks.
 * Matt mode: series mattSheen only. Glossy: series glossBoost (zone must allow gloss).
 */
export function effectiveGlossMultiplier(
  finish: "matt" | "glossy",
  hint: SeriesFinishHint | undefined,
  zoneAllowsGloss: boolean
): number {
  const h = hint ?? HINTS.default;
  if (finish === "glossy" && zoneAllowsGloss) return h.glossBoost;
  if (finish === "matt") return h.mattSheen;
  return 1;
}

export function effectiveHighlightAlpha(
  finish: "matt" | "glossy",
  hint: SeriesFinishHint | undefined
): number {
  if (finish !== "glossy") return 0;
  return (hint ?? HINTS.default).highlightAlpha;
}
