import type { WoodSwatch } from "./palettes";

/** Editable rate table — replace with real lamination sheet rates later */
export const WOOD_RATES_PER_SQFT: Record<WoodSwatch["tier"], number> = {
  economy: 850,
  standard: 1200,
  premium: 1650,
};

export const WALL_PAINT_FLAT_RATE = 18000;

export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}
