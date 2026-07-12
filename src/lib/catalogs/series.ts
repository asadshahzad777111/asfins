import type { CatalogSwatch } from "@/lib/catalogs/types";

/** Known series labels that may appear in titles when materialCategory is missing. */
const SERIES_NAME_PATTERNS: RegExp[] = [
  /\bUV\s*Lux\b/i,
  /\bHigh\s*Gloss\s*Elite\b/i,
  /\bLamination\s*Series\b/i,
  /\bTextured\s*Laminates?\b/i,
  /\bSyncron\s*Line\b/i,
  /\bPatex\s*Elegance\b/i,
  /\bPatex\s*Lamination\b/i,
  /\bHigh\s*Gloss\b/i,
  /\bMatt(?:e)?\s*Series\b/i,
];

export const SERIES_OTHER = "Other";

/**
 * Infer a series/folder label for a catalog swatch.
 * Prefers materialCategory (ZRK series), then surfaceFinish, then title parse.
 */
export function getSwatchSeries(swatch: CatalogSwatch): string {
  const category = swatch.materialCategory?.trim();
  if (category) return category;

  const finish = swatch.surfaceFinish?.trim();
  if (finish && !isGenericFinish(finish)) return finish;

  const fromName = parseSeriesFromTitle(swatch.name);
  if (fromName) return fromName;

  return SERIES_OTHER;
}

function isGenericFinish(finish: string): boolean {
  return /^(wood\s*grain|marble|leather|classic|glitter|solid|fabric)$/i.test(
    finish.trim()
  );
}

function parseSeriesFromTitle(name: string): string | null {
  for (const re of SERIES_NAME_PATTERNS) {
    const m = name.match(re);
    if (m?.[0]) {
      return m[0].replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  const dash = name.match(/^(.+?)\s*[-–—|]\s+.+/);
  if (dash?.[1] && dash[1].length >= 3 && dash[1].length <= 40) {
    return dash[1].trim();
  }
  return null;
}

export interface SeriesFolder {
  id: string;
  name: string;
  count: number;
  previewUrl?: string;
  previewHex?: string;
}

export function groupSwatchesBySeries(swatches: CatalogSwatch[]): SeriesFolder[] {
  const map = new Map<string, SeriesFolder & { _swatches: CatalogSwatch[] }>();

  for (const swatch of swatches) {
    const name = getSwatchSeries(swatch);
    const id = slugSeriesId(name);
    let folder = map.get(id);
    if (!folder) {
      folder = { id, name, count: 0, _swatches: [] };
      map.set(id, folder);
    }
    folder.count += 1;
    folder._swatches.push(swatch);
  }

  return Array.from(map.values())
    .map(({ _swatches, ...folder }) => {
      const preview =
        _swatches.find((s) => s.thumbUrl || s.imageUrl) ?? _swatches[0];
      return {
        ...folder,
        previewUrl: preview?.thumbUrl ?? preview?.imageUrl,
        previewHex: preview?.hex,
      };
    })
    .sort((a, b) => {
      if (a.name === SERIES_OTHER) return 1;
      if (b.name === SERIES_OTHER) return -1;
      return b.count - a.count || a.name.localeCompare(b.name);
    });
}

export function filterSwatchesBySeries(
  swatches: CatalogSwatch[],
  seriesId: string | null
): CatalogSwatch[] {
  if (!seriesId) return swatches;
  return swatches.filter((s) => slugSeriesId(getSwatchSeries(s)) === seriesId);
}

export function slugSeriesId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
