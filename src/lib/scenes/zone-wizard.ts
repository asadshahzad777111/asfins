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

export type WizardStep = "info" | "cutout" | "zones" | "mapping" | "review";

export function wizardProgress(
  step: WizardStep,
  questionIndex: number,
  totalQuestions: number
): { current: number; total: number } {
  const stepOffsets: Record<WizardStep, number> = {
    info: 1,
    cutout: 2,
    zones: 3,
    mapping: 4,
    review: 4 + totalQuestions,
  };
  const current =
    step === "mapping" ? 4 + questionIndex : stepOffsets[step];
  const total = 4 + totalQuestions + 1;
  return { current, total };
}
