import type { ZoneGroup, ZonePalette, RoomCategory } from "./types";
import type { TranslationKey } from "@/lib/i18n/translations";

export interface ZoneQuestion {
  id: string;
  labelKey: TranslationKey;
  palette: ZonePalette;
  zoneGroup: ZoneGroup;
  optional?: boolean;
  sectionKey?: TranslationKey;
}

const KITCHEN_QUESTIONS: ZoneQuestion[] = [
  { id: "floor", labelKey: "zoneFloor", palette: "paint", zoneGroup: "surface", sectionKey: "wizardSectionSurfaces" },
  { id: "ceiling", labelKey: "zoneCeiling", palette: "paint", zoneGroup: "surface", optional: true, sectionKey: "wizardSectionSurfaces" },
  { id: "wall-left", labelKey: "zoneWallLeft", palette: "paint", zoneGroup: "surface", optional: true, sectionKey: "wizardSectionSurfaces" },
  { id: "wall-back", labelKey: "zoneWallBack", palette: "paint", zoneGroup: "surface", optional: true, sectionKey: "wizardSectionSurfaces" },
  { id: "wall-right", labelKey: "zoneWallRight", palette: "paint", zoneGroup: "surface", optional: true, sectionKey: "wizardSectionSurfaces" },
  { id: "curtains", labelKey: "zoneCurtains", palette: "paint", zoneGroup: "surface", optional: true, sectionKey: "wizardSectionSurfaces" },

  { id: "upper-cabinet-left", labelKey: "zoneUpperCabLeft", palette: "wood", zoneGroup: "wood", sectionKey: "wizardSectionUpperCabs" },
  { id: "upper-cabinet-mid", labelKey: "zoneUpperCabMid", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionUpperCabs" },
  { id: "upper-cabinet-right", labelKey: "zoneUpperCabRight", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionUpperCabs" },

  { id: "upper-door-1", labelKey: "zoneUpperDoor1", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionUpperDoors" },
  { id: "upper-door-2", labelKey: "zoneUpperDoor2", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionUpperDoors" },
  { id: "upper-door-3", labelKey: "zoneUpperDoor3", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionUpperDoors" },
  { id: "upper-door-4", labelKey: "zoneUpperDoor4", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionUpperDoors" },

  { id: "lower-cabinet-left", labelKey: "zoneLowerCabLeft", palette: "wood", zoneGroup: "wood", sectionKey: "wizardSectionLowerCabs" },
  { id: "lower-cabinet-mid", labelKey: "zoneLowerCabMid", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionLowerCabs" },
  { id: "lower-cabinet-right", labelKey: "zoneLowerCabRight", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionLowerCabs" },

  { id: "lower-door-1", labelKey: "zoneLowerDoor1", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionLowerDoors" },
  { id: "lower-door-2", labelKey: "zoneLowerDoor2", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionLowerDoors" },
  { id: "lower-door-3", labelKey: "zoneLowerDoor3", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionLowerDoors" },
  { id: "lower-door-4", labelKey: "zoneLowerDoor4", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionLowerDoors" },

  { id: "island", labelKey: "zoneIsland", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionExtras" },
  { id: "countertop", labelKey: "zoneCountertop", palette: "tile", zoneGroup: "tile", optional: true, sectionKey: "wizardSectionExtras" },
  { id: "backsplash", labelKey: "zoneBacksplash", palette: "tile", zoneGroup: "tile", optional: true, sectionKey: "wizardSectionExtras" },
  { id: "table", labelKey: "zoneTable", palette: "wood", zoneGroup: "wood", optional: true, sectionKey: "wizardSectionExtras" },
];

const GENERIC_QUESTIONS: ZoneQuestion[] = [
  { id: "floor", labelKey: "zoneFloor", palette: "paint", zoneGroup: "surface" },
  { id: "wall", labelKey: "zoneWall", palette: "paint", zoneGroup: "surface", optional: true },
  { id: "cabinets", labelKey: "defaultZoneLabel", palette: "wood", zoneGroup: "wood" },
];

export function getZoneQuestions(category: RoomCategory): ZoneQuestion[] {
  if (category === "kitchen") return KITCHEN_QUESTIONS;
  return GENERIC_QUESTIONS;
}

export function getZoneQuestionById(
  category: RoomCategory,
  zoneId: string
): ZoneQuestion | undefined {
  return getZoneQuestions(category).find((q) => q.id === zoneId);
}

/** Zone questions that map 1:1 to a single upload slot (not repeatable) — everything except wood/cabinet zones. */
export function getSingleInstanceZoneQuestions(category: RoomCategory): ZoneQuestion[] {
  return getZoneQuestions(category).filter((q) => q.zoneGroup !== "wood");
}

export type WizardStep = "info" | "cutout" | "zones" | "mapping" | "simpleZones" | "review";

export type WizardFlow = "simple" | "advanced";

/**
 * Customer-facing Studio controls. Multiple Advanced mapping slots (left/centre/right)
 * can merge into one of these so the client sees a single "Lower Cabinets" button.
 */
export interface StudioZoneTarget {
  id: string;
  labelKey: TranslationKey;
  palette: ZonePalette;
  zoneGroup: ZoneGroup;
}

export const STUDIO_CABINET_TARGETS: StudioZoneTarget[] = [
  {
    id: "lower-cabinets",
    labelKey: "zoneLowerCabinets",
    palette: "wood",
    zoneGroup: "wood",
  },
  {
    id: "upper-cabinets",
    labelKey: "zoneUpperCabinets",
    palette: "wood",
    zoneGroup: "wood",
  },
  {
    id: "island",
    labelKey: "zoneIsland",
    palette: "wood",
    zoneGroup: "wood",
  },
  {
    id: "cabinets",
    labelKey: "defaultZoneLabel",
    palette: "wood",
    zoneGroup: "wood",
  },
];

/**
 * Optional merge target for a fine-grained Advanced mapping slot
 * (used when admin clicks “Merge all cabinet parts…”).
 */
export function mergedStudioZoneId(slotId: string): string {
  if (
    slotId === "lower-cabinets" ||
    slotId.startsWith("lower-cabinet") ||
    slotId.startsWith("lower-door")
  ) {
    return "lower-cabinets";
  }
  if (
    slotId === "upper-cabinets" ||
    slotId.startsWith("upper-cabinet") ||
    slotId.startsWith("upper-door")
  ) {
    return "upper-cabinets";
  }
  if (slotId === "island" || slotId === "table") return "island";
  if (slotId === "cabinets" || slotId === "shelves" || slotId === "side-cabinets") {
    return slotId === "shelves" ? "shelves" : "cabinets";
  }
  return slotId;
}

/**
 * Default Studio control for a tagged slot: keep the tagged identity
 * (left/right stay separate) unless admin assigns the same Studio control.
 */
export function defaultStudioZoneId(slotId: string): string {
  return slotId;
}

export function buildDefaultStudioTargets(
  assignments: Record<string, number[]>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slotId of Object.keys(assignments)) {
    out[slotId] = defaultStudioZoneId(slotId);
  }
  return out;
}

/** Explicit merge map for “Merge all cabinet parts into Lower / Upper / Island”. */
export function buildMergedStudioTargets(
  assignments: Record<string, number[]>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slotId of Object.keys(assignments)) {
    out[slotId] = mergedStudioZoneId(slotId);
  }
  return out;
}

/**
 * Collapse Advanced slot→region maps into Studio zone→union(regions).
 * Same target id ⇒ one customer control + one union mask on save.
 */
export function mergeAssignmentsToStudioZones(
  assignments: Record<string, number[]>,
  targetBySlot: Record<string, string>
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [slotId, regionIds] of Object.entries(assignments)) {
    if (!regionIds.length) continue;
    const target = targetBySlot[slotId] ?? defaultStudioZoneId(slotId);
    const merged = new Set([...(out[target] ?? []), ...regionIds]);
    out[target] = Array.from(merged).sort((a, b) => a - b);
  }
  return out;
}

export function resolveStudioZoneMeta(
  zoneId: string,
  category: RoomCategory
): { id: string; labelKey: TranslationKey; palette: ZonePalette; zoneGroup: ZoneGroup } {
  const cabinet = STUDIO_CABINET_TARGETS.find((t) => t.id === zoneId);
  if (cabinet) return cabinet;
  const q = getZoneQuestionById(category, zoneId);
  if (q) {
    return {
      id: q.id,
      labelKey: q.labelKey,
      palette: q.palette,
      zoneGroup: q.zoneGroup,
    };
  }
  return {
    id: zoneId,
    labelKey: "defaultZoneLabel",
    palette: "wood",
    zoneGroup: "wood",
  };
}

/** Dropdown options for Advanced review: shared cabinet targets + keep-as-mapped slots. */
export function studioTargetOptionsForSlots(
  slotIds: string[],
  category: RoomCategory
): StudioZoneTarget[] {
  const byId = new Map<string, StudioZoneTarget>();
  for (const t of STUDIO_CABINET_TARGETS) byId.set(t.id, t);
  for (const slotId of slotIds) {
    const meta = resolveStudioZoneMeta(slotId, category);
    if (!byId.has(meta.id)) {
      byId.set(meta.id, {
        id: meta.id,
        labelKey: meta.labelKey,
        palette: meta.palette,
        zoneGroup: meta.zoneGroup,
      });
    }
    // Also offer keeping the fine-grained slot as its own Studio control.
    if (!byId.has(slotId)) {
      const q = getZoneQuestionById(category, slotId);
      byId.set(slotId, {
        id: slotId,
        labelKey: q?.labelKey ?? "defaultZoneLabel",
        palette: q?.palette ?? "wood",
        zoneGroup: q?.zoneGroup ?? "wood",
      });
    }
  }
  return Array.from(byId.values());
}

export function wizardProgress(
  step: WizardStep,
  questionIndex: number,
  totalQuestions: number,
  flow: WizardFlow = "advanced"
): { current: number; total: number } {
  if (flow === "simple") {
    const simpleOffsets: Record<string, number> = { info: 1, simpleZones: 2, review: 3 };
    return { current: simpleOffsets[step] ?? 1, total: 3 };
  }

  const stepOffsets: Record<WizardStep, number> = {
    info: 1,
    cutout: 2,
    zones: 3,
    mapping: 4,
    simpleZones: 2,
    review: 4 + totalQuestions,
  };
  const current =
    step === "mapping" ? 4 + questionIndex : stepOffsets[step];
  const total = 4 + totalQuestions + 1;
  return { current, total };
}
