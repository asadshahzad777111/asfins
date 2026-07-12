import type { WoodSwatch } from "./palettes";
import type { Substrate } from "./stock";

/** Editable rate table — replace with real lamination sheet rates later */
export const WOOD_RATES_PER_SQFT: Record<WoodSwatch["tier"], number> = {
  economy: 850,
  standard: 1200,
  premium: 1650,
};

export const WALL_PAINT_FLAT_RATE = 18000;

/** Default PKR per sheet by series (+ optional substrate track). */
export const SERIES_SHEET_RATES_PKR: Array<{
  match: RegExp;
  substrate?: Substrate | null;
  rate: number;
}> = [
  { match: /uv\s*lux/i, rate: 9000 },
  { match: /lamination\s*series/i, substrate: "mdf", rate: 5000 },
  { match: /lamination\s*series/i, substrate: "chipboard", rate: 3400 },
  { match: /high\s*gloss\s*elite/i, rate: 7500 },
  { match: /textured\s*laminat/i, rate: 9000 },
  { match: /syncron\s*line/i, rate: 12000 },
  { match: /patex\s*elegance/i, rate: 8000 },
  { match: /patex/i, substrate: "mdf", rate: 7000 },
  { match: /patex\s*lamination/i, rate: 6000 },
  { match: /patex/i, rate: 6000 },
];

export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function lookupSeriesSheetRate(
  seriesOrCategory?: string | null,
  substrate?: Substrate | null
): number | undefined {
  const text = (seriesOrCategory ?? "").trim();
  if (!text) return undefined;

  // Prefer exact substrate match, then null/any track.
  const withSub = SERIES_SHEET_RATES_PKR.find(
    (row) =>
      row.match.test(text) &&
      row.substrate != null &&
      substrate != null &&
      row.substrate === substrate
  );
  if (withSub) return withSub.rate;

  const any = SERIES_SHEET_RATES_PKR.find(
    (row) => row.match.test(text) && row.substrate == null
  );
  if (any) return any.rate;

  // Lamination Series without substrate → MDF track default
  if (/lamination\s*series/i.test(text)) {
    return substrate === "chipboard" ? 3400 : 5000;
  }

  return undefined;
}

/** Prefer explicit product/swatch price; else series table. */
export function resolveSheetRate(opts: {
  pricePKR?: number | null;
  materialCategory?: string | null;
  description?: string | null;
  substrate?: Substrate | null;
  seriesHint?: string | null;
}): number {
  if (opts.pricePKR != null && opts.pricePKR > 0) return opts.pricePKR;
  const series =
    opts.seriesHint ??
    opts.materialCategory ??
    parseSeriesFromDescription(opts.description);
  return lookupSeriesSheetRate(series, opts.substrate) ?? 0;
}

export function parseSeriesFromDescription(
  description?: string | null
): string | undefined {
  if (!description) return undefined;
  const m = description.match(/A\s+(.+?)\s+product\b/i);
  return m?.[1]?.trim();
}
