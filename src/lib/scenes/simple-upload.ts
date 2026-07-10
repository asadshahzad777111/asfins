import type { RoomCategory, SceneRecord, ZonePalette } from "./types";
import { getSingleInstanceZoneQuestions } from "./zone-wizard";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  emptyImageSource,
  type ImageSourceValue,
} from "@/components/admin/ImageSourceInput";

/**
 * One upload row in the simplified "per-zone cutout" flow — either a fixed single-instance
 * slot (floor, wall, ceiling, …) or a repeatable cabinet-cutout row the admin names themselves.
 */
export interface SimpleZoneRow {
  key: string;
  /** Set once a zone has a stable id — either a fixed single-instance slot, or an existing
   *  cabinet zone being edited. Left unset for a brand-new cabinet row (backend derives an id
   *  from the label on save). */
  id?: string;
  kind: "single" | "cabinet";
  /** Translated label for "single" rows with a known slot; ignored otherwise. */
  labelKey?: TranslationKey;
  /** Free-text label — the only label source for "cabinet" rows, and the fallback for legacy
   *  "single" zones carried over from an existing scene that don't match a known slot. */
  label: string;
  palette: ZonePalette;
  sectionKey?: TranslationKey;
  optional?: boolean;
  source: ImageSourceValue;
  /** True if this exact zone id already existed on the scene before this edit session. */
  existedBefore: boolean;
  /** Marked for removal — excluded from save, and (if it existed before) reported to the backend. */
  removed: boolean;
}

function hasSource(source: ImageSourceValue): boolean {
  return Boolean(source.file || source.url || source.preview);
}

let rowCounter = 0;
function nextRowKey(prefix: string): string {
  rowCounter += 1;
  return `${prefix}-${rowCounter}-${Date.now()}`;
}

/** Builds the initial row list for the simple flow: known single-instance slots for this
 *  room category, plus (when editing) every existing zone — filling in known slots and
 *  appending any legacy zone that doesn't match one, so nothing from an older scene is lost. */
export function buildInitialSimpleZoneRows(
  category: RoomCategory,
  existingScene?: SceneRecord
): SimpleZoneRow[] {
  const rows: SimpleZoneRow[] = [];
  const singleQuestions = getSingleInstanceZoneQuestions(category);
  const covered = new Set<string>();

  for (const q of singleQuestions) {
    covered.add(q.id);
    const existingZone = existingScene?.zones.find((z) => z.id === q.id);
    rows.push({
      key: q.id,
      id: q.id,
      kind: "single",
      labelKey: q.labelKey,
      label: "",
      palette: q.palette,
      sectionKey: q.sectionKey,
      optional: q.optional,
      source: existingZone
        ? {
            file: null,
            url: "",
            preview: `/scenes/${existingScene!.id}/mask-${q.id}.png`,
            mode: "upload",
          }
        : emptyImageSource(),
      existedBefore: Boolean(existingZone),
      removed: false,
    });
  }

  if (existingScene) {
    for (const z of existingScene.zones) {
      if (covered.has(z.id)) continue;
      covered.add(z.id);
      const isCabinet = z.palette === "wood";
      rows.push({
        key: z.id,
        id: z.id,
        kind: isCabinet ? "cabinet" : "single",
        label: z.label,
        palette: z.palette,
        source: {
          file: null,
          url: "",
          preview: `/scenes/${existingScene.id}/mask-${z.id}.png`,
          mode: "upload",
        },
        existedBefore: true,
        removed: false,
      });
    }
  } else {
    // Seed one empty cabinet row so the admin immediately sees where to add cabinets.
    rows.push(newCabinetRow());
  }

  return rows;
}

export function newCabinetRow(): SimpleZoneRow {
  return {
    key: nextRowKey("cabinet"),
    id: undefined,
    kind: "cabinet",
    label: "",
    palette: "wood",
    source: emptyImageSource(),
    existedBefore: false,
    removed: false,
  };
}

export function isRowConfigured(row: SimpleZoneRow): boolean {
  if (row.removed) return false;
  if (row.kind === "cabinet" && !row.label.trim()) return false;
  return hasSource(row.source) || row.existedBefore;
}

export function anyZoneConfigured(rows: SimpleZoneRow[]): boolean {
  return rows.some(isRowConfigured);
}

export interface SimpleZoneSubmission {
  id?: string;
  label: string;
  palette: ZonePalette;
  source: ImageSourceValue;
  /** No new file for this save — backend should reuse whatever is already on disk for this id. */
  keepExisting: boolean;
}

export function buildSimpleZoneSubmissions(
  rows: SimpleZoneRow[],
  t: (key: TranslationKey) => string
): SimpleZoneSubmission[] {
  const out: SimpleZoneSubmission[] = [];
  for (const row of rows) {
    if (!isRowConfigured(row)) continue;
    const label =
      row.kind === "single" && row.labelKey ? t(row.labelKey) : row.label.trim();
    const hasNewFile = Boolean(row.source.file || row.source.url);
    out.push({
      id: row.id,
      label,
      palette: row.palette,
      source: row.source,
      keepExisting: row.existedBefore && !hasNewFile,
    });
  }
  return out;
}

export function collectRemovedZoneIds(rows: SimpleZoneRow[]): string[] {
  return rows.filter((r) => r.removed && r.existedBefore && r.id).map((r) => r.id!);
}
