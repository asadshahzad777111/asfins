export type ZoneId = string;

export type ZonePalette = "wood" | "paint" | "tile";

export type ZoneGroup = "wood" | "tile" | "surface";

export type RoomCategory =
  | "kitchen"
  | "bathroom"
  | "basement"
  | "tv-lounge"
  | "bedroom"
  | "other";

export interface SceneZoneConfig {
  id: ZoneId;
  label: string;
  maskPath: string;
  palette: ZonePalette;
  /** UI grouping — inferred from palette/id when omitted */
  zoneGroup?: ZoneGroup;
  zIndex: number;
  glossyHighlight: boolean;
}

export interface SceneConfig {
  id: string;
  name: string;
  description: string;
  category: RoomCategory;
  width: number;
  height: number;
  basePhoto: string;
  highlightMap: string;
  nightGlow: string;
  zones: SceneZoneConfig[];
  /** Optional catalog IDs linked to this scene */
  catalogIds?: string[];
}

export interface SceneRecord extends SceneConfig {
  thumbnail: string;
  createdAt: string;
  published: boolean;
  /** Zone id → connected-region ids from master cutout (wizard scenes). */
  regionMappings?: Record<string, number[]>;
}

export interface SceneRegistry {
  scenes: SceneRecord[];
}

export const ZONE_META: Record<
  string,
  Omit<SceneZoneConfig, "id" | "maskPath" | "label">
> = {
  floor: { palette: "paint", zoneGroup: "surface", zIndex: 1, glossyHighlight: false },
  ceiling: { palette: "paint", zoneGroup: "surface", zIndex: 1, glossyHighlight: false },
  wall: { palette: "paint", zoneGroup: "surface", zIndex: 2, glossyHighlight: false },
  "wall-left": { palette: "paint", zoneGroup: "surface", zIndex: 2, glossyHighlight: false },
  "wall-back": { palette: "paint", zoneGroup: "surface", zIndex: 2, glossyHighlight: false },
  "wall-right": { palette: "paint", zoneGroup: "surface", zIndex: 2, glossyHighlight: false },
  curtains: { palette: "paint", zoneGroup: "surface", zIndex: 3, glossyHighlight: false },
  "lower-cabinets": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-cabinets-island": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-cabinet-left": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-cabinet-mid": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-cabinet-right": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-door-1": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-door-2": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-door-3": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "lower-door-4": { palette: "wood", zoneGroup: "wood", zIndex: 10, glossyHighlight: true },
  "upper-cabinets": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-cabinet-left": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-cabinet-mid": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-cabinet-right": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-door-1": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-door-2": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-door-3": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "upper-door-4": { palette: "wood", zoneGroup: "wood", zIndex: 11, glossyHighlight: true },
  "side-cabinets": { palette: "wood", zoneGroup: "wood", zIndex: 12, glossyHighlight: true },
  "tall-cabinets": { palette: "wood", zoneGroup: "wood", zIndex: 12, glossyHighlight: true },
  backsplash: { palette: "tile", zoneGroup: "tile", zIndex: 5, glossyHighlight: false },
  countertop: { palette: "tile", zoneGroup: "tile", zIndex: 6, glossyHighlight: false },
  cabinets: { palette: "wood", zoneGroup: "wood", zIndex: 12, glossyHighlight: true },
  island: { palette: "wood", zoneGroup: "wood", zIndex: 13, glossyHighlight: true },
  table: { palette: "wood", zoneGroup: "wood", zIndex: 13, glossyHighlight: true },
  shelves: { palette: "wood", zoneGroup: "wood", zIndex: 14, glossyHighlight: true },
};

export const LEGACY_ZONE_IDS = [
  "floor",
  "wall",
  "lower-cabinets",
  "upper-cabinets",
  "backsplash",
  "countertop",
  "cabinets",
  "island",
  "shelves",
] as const;

export const LEGACY_ZONE_LABELS: Record<string, string> = {
  floor: "Floor",
  wall: "Wall",
  "lower-cabinets": "Lower Cabinets",
  "upper-cabinets": "Upper Cabinets",
  backsplash: "Backsplash / Tiles",
  countertop: "Countertop",
  cabinets: "Cabinets (Almari)",
  island: "Kitchen Island",
  shelves: "Floating Shelves",
};
