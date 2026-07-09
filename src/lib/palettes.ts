export interface WoodSwatch {
  id: string;
  name: string;
  hex: string;
  sheetCode: string;
  tier: "economy" | "standard" | "premium";
}

export interface PaintSwatch {
  id: string;
  name: string;
  hex: string;
  sheetCode: string;
}

export const WOOD_PALETTE: WoodSwatch[] = [
  { id: "charcoal", name: "Charcoal", hex: "#3D4555", sheetCode: "LAM-CH-01", tier: "standard" },
  { id: "walnut", name: "Walnut", hex: "#5C4033", sheetCode: "LAM-WAL-18", tier: "premium" },
  { id: "oak", name: "Oak", hex: "#C4A574", sheetCode: "LAM-OAK-12", tier: "standard" },
  { id: "teak", name: "Teak", hex: "#8B6914", sheetCode: "LAM-TEK-09", tier: "premium" },
  { id: "ash", name: "Ash", hex: "#B8A99A", sheetCode: "LAM-ASH-06", tier: "economy" },
  { id: "white", name: "White PVC", hex: "#F5F0E8", sheetCode: "LAM-WHT-02", tier: "economy" },
  { id: "navy", name: "Navy Blue", hex: "#2C3E50", sheetCode: "LAM-NVY-14", tier: "premium" },
  { id: "sage", name: "Sage Green", hex: "#7D8B6A", sheetCode: "LAM-SGE-08", tier: "standard" },
];

export const WALL_PALETTE: PaintSwatch[] = [
  { id: "off-white", name: "Off-White", hex: "#F5F0E8", sheetCode: "PNT-OW-01" },
  { id: "light-grey", name: "Light Grey", hex: "#C8C2B8", sheetCode: "PNT-LG-04" },
  { id: "beige", name: "Beige", hex: "#D9CDB8", sheetCode: "PNT-BG-07" },
  { id: "charcoal", name: "Charcoal", hex: "#3D3832", sheetCode: "PNT-CH-11" },
  { id: "warm-stone", name: "Warm Stone", hex: "#A89B8A", sheetCode: "PNT-WS-03" },
];

export const WOOD_ZONE_IDS = ["cabinets", "island", "shelves"] as const;
export type WoodZoneId = (typeof WOOD_ZONE_IDS)[number];
