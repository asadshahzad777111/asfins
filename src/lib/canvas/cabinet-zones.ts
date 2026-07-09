import type { SceneZoneConfig } from "@/lib/scenes/types";
import { inferZoneGroup } from "@/lib/scenes/zones";

/** Zones excluded from click-to-paint overlay (floor, walls, curtains, etc.). */
const EXCLUDED_OVERLAY_IDS = new Set([
  "floor",
  "ceiling",
  "wall-left",
  "wall-back",
  "wall-right",
  "wall",
  "curtains",
  "countertop",
  "backsplash",
  "table",
]);

/** Cabinet / wood zones that support Asphalt-style click-to-paint. */
export function isCabinetClickZone(zone: SceneZoneConfig): boolean {
  if (EXCLUDED_OVERLAY_IDS.has(zone.id)) return false;
  return inferZoneGroup(zone) === "wood";
}

export function getCabinetClickZones(zones: SceneZoneConfig[]): SceneZoneConfig[] {
  return zones.filter(isCabinetClickZone);
}

export function sceneHasCabinetClickZones(zones: SceneZoneConfig[]): boolean {
  return getCabinetClickZones(zones).length > 0;
}
