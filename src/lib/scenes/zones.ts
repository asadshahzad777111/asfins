import type { SceneZoneConfig, ZoneGroup, ZonePalette } from "./types";
import type { TranslationKey } from "@/lib/i18n/translations";

export function inferZoneGroup(zone: SceneZoneConfig): ZoneGroup {
  if (zone.zoneGroup) return zone.zoneGroup;
  if (zone.palette === "wood") return "wood";
  if (
    zone.palette === "tile" ||
    zone.id.includes("backsplash") ||
    zone.id.includes("countertop") ||
    zone.id.includes("tile")
  ) {
    return "tile";
  }
  return "surface";
}

export function groupZones(zones: SceneZoneConfig[]): Record<ZoneGroup, SceneZoneConfig[]> {
  const groups: Record<ZoneGroup, SceneZoneConfig[]> = {
    wood: [],
    tile: [],
    surface: [],
  };
  for (const zone of zones) {
    groups[inferZoneGroup(zone)].push(zone);
  }
  return groups;
}

export function getWoodZones(zones: SceneZoneConfig[]): SceneZoneConfig[] {
  return zones.filter((z) => z.palette === "wood");
}

export function hasDoubleShade(zones: SceneZoneConfig[]): boolean {
  return getWoodZones(zones).length >= 2;
}

/** Map upper/lower wood zones for double-shade presets. */
export function resolveWoodPair(
  zones: SceneZoneConfig[]
): { upperId?: string; lowerId?: string; woodIds: string[] } {
  const wood = getWoodZones(zones).sort((a, b) => a.zIndex - b.zIndex);
  const woodIds = wood.map((z) => z.id);

  const upper = wood.find(
    (z) => /upper/i.test(z.id) || /upper/i.test(z.label) || /opar/i.test(z.label)
  );
  const lower = wood.find(
    (z) => /lower/i.test(z.id) || /lower/i.test(z.label) || /neeche/i.test(z.label)
  );

  if (upper && lower) {
    return { upperId: upper.id, lowerId: lower.id, woodIds };
  }
  if (wood.length >= 2) {
    return { upperId: wood[0].id, lowerId: wood[1].id, woodIds };
  }
  return { woodIds };
}

export interface KitchenZonePreset {
  id: string;
  labelKey: TranslationKey;
  palette: ZonePalette;
  zoneGroup: ZoneGroup;
  optional?: boolean;
}

export const KITCHEN_ZONE_PRESETS: KitchenZonePreset[] = [
  { id: "lower-cabinets", labelKey: "zoneLowerCabinets", palette: "wood", zoneGroup: "wood" },
  { id: "upper-cabinets", labelKey: "zoneUpperCabinets", palette: "wood", zoneGroup: "wood" },
  { id: "backsplash", labelKey: "zoneBacksplash", palette: "tile", zoneGroup: "tile" },
  { id: "countertop", labelKey: "zoneCountertop", palette: "tile", zoneGroup: "tile", optional: true },
  { id: "wall", labelKey: "zoneWall", palette: "paint", zoneGroup: "surface" },
  { id: "floor", labelKey: "zoneFloor", palette: "paint", zoneGroup: "surface" },
];

export function defaultColorForPalette(palette: ZonePalette): string {
  if (palette === "wood") return "#3D4555";
  if (palette === "tile") return "#E8E4DC";
  return "#F5F0E8";
}

export interface DoubleShadePresetDef {
  id: string;
  labelKey: TranslationKey;
  upperHex: string;
  lowerHex: string;
}

export const DOUBLE_SHADE_PRESETS: DoubleShadePresetDef[] = [
  {
    id: "walnut-white",
    labelKey: "doubleShadeWalnutWhite",
    upperHex: "#F5F0E8",
    lowerHex: "#5C4033",
  },
  {
    id: "oak-charcoal",
    labelKey: "doubleShadeOakCharcoal",
    upperHex: "#3D4555",
    lowerHex: "#C4A574",
  },
  {
    id: "white-navy",
    labelKey: "doubleShadeWhiteNavy",
    upperHex: "#2C3E50",
    lowerHex: "#F5F0E8",
  },
  {
    id: "teak-sage",
    labelKey: "doubleShadeTeakSage",
    upperHex: "#7D8B6A",
    lowerHex: "#8B6914",
  },
];
