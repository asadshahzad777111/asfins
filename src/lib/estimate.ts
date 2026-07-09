import type { CatalogSwatch } from "./catalogs/types";
import { WOOD_PALETTE } from "./palettes";
import { WALL_PAINT_FLAT_RATE, WOOD_RATES_PER_SQFT } from "./rates";
import type { ZoneColors } from "./canvas/engine";
import type { SceneZoneConfig } from "./scenes/types";

export function estimateCost(
  sqFt: number,
  zoneColors: ZoneColors,
  zones: SceneZoneConfig[],
  swatches?: CatalogSwatch[]
): { woodTotal: number; wallTotal: number; grandTotal: number; woodTier: string } {
  const woodZones = zones.filter((z) => z.palette === "wood");
  const paintZones = zones.filter((z) => z.palette === "paint");

  const woodHexes = woodZones.map((z) => zoneColors[z.id]).filter(Boolean);
  const tiers = woodHexes.map((hex) => {
    const sw = swatches?.find((s) => s.hex.toLowerCase() === hex.toLowerCase());
    if (sw?.pricePKR) {
      if (sw.pricePKR >= 2200) return "premium";
      if (sw.pricePKR >= 1900) return "standard";
      return "economy";
    }
    const legacy = WOOD_PALETTE.find((w) => w.hex.toLowerCase() === hex.toLowerCase());
    return legacy?.tier ?? "standard";
  });

  const maxTier = tiers.includes("premium")
    ? "premium"
    : tiers.includes("standard")
      ? "standard"
      : "economy";
  const rate = WOOD_RATES_PER_SQFT[maxTier];
  const woodTotal = woodZones.length > 0 ? sqFt * rate * 0.6 : 0;

  const hasPaint = paintZones.length > 0;
  const wallTotal = hasPaint ? WALL_PAINT_FLAT_RATE : 0;

  return {
    woodTotal,
    wallTotal,
    grandTotal: woodTotal + wallTotal,
    woodTier: maxTier,
  };
}

export function nameFromHex(hex: string, swatches?: CatalogSwatch[]): string {
  const sw = swatches?.find((s) => s.hex.toLowerCase() === hex.toLowerCase());
  if (sw) return sw.name;
  const legacy = WOOD_PALETTE.find((w) => w.hex.toLowerCase() === hex.toLowerCase());
  return legacy?.name ?? hex;
}

export function sheetCodeFromHex(hex: string, swatches?: CatalogSwatch[]): string | null {
  const sw = swatches?.find((s) => s.hex.toLowerCase() === hex.toLowerCase());
  return sw?.sheetCode ?? null;
}

export function woodNameFromHex(hex: string): string {
  return WOOD_PALETTE.find((w) => w.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

export function wallNameFromHex(hex: string): string {
  return hex;
}
