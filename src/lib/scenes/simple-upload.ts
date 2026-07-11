import type { RoomCategory, SceneRecord, ZonePalette } from "./types";
import { getSingleInstanceZoneQuestions, getZoneQuestionById } from "./zone-wizard";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { Catalog } from "@/lib/catalogs/types";
import { defaultCatalogIdsForPalette } from "@/lib/catalogs/materials";
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
  /** Catalogs linked to this zone (filtered by palette in the UI). */
  catalogIds: string[];
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
  existingScene?: SceneRecord,
  catalogs: Catalog[] = []
): SimpleZoneRow[] {
  const rows: SimpleZoneRow[] = [];
  const singleQuestions = getSingleInstanceZoneQuestions(category);
  const covered = new Set<string>();
  const sceneCatalogIds = existingScene?.catalogIds;

  for (const q of singleQuestions) {
    covered.add(q.id);
    const existingZone = existingScene?.zones.find((z) => z.id === q.id);
    const palette = existingZone?.palette ?? q.palette;
    rows.push({
      key: q.id,
      id: q.id,
      kind: "single",
      labelKey: q.labelKey,
      label: "",
      palette,
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
      catalogIds: defaultCatalogIdsForPalette(catalogs, palette, sceneCatalogIds),
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
        catalogIds: defaultCatalogIdsForPalette(catalogs, z.palette, sceneCatalogIds),
        existedBefore: true,
        removed: false,
      });
    }
  } else {
    // Seed one empty cabinet row so the admin immediately sees where to add cabinets.
    rows.push(newCabinetRow(catalogs));
  }

  return rows;
}

export function newCabinetRow(catalogs: Catalog[] = []): SimpleZoneRow {
  return {
    key: nextRowKey("cabinet"),
    id: undefined,
    kind: "cabinet",
    label: "",
    palette: "wood",
    source: emptyImageSource(),
    catalogIds: defaultCatalogIdsForPalette(catalogs, "wood"),
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
  catalogIds: string[];
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
      catalogIds: row.catalogIds,
      keepExisting: row.existedBefore && !hasNewFile,
    });
  }
  return out;
}

export function collectRemovedZoneIds(rows: SimpleZoneRow[]): string[] {
  return rows.filter((r) => r.removed && r.existedBefore && r.id).map((r) => r.id!);
}

/** Union of all per-zone catalog selections for the scene-level catalogIds field. */
export function collectSceneCatalogIds(rows: SimpleZoneRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!isRowConfigured(row)) continue;
    for (const id of row.catalogIds) ids.add(id);
  }
  return Array.from(ids);
}

/** Reassign a single-instance row to a different zone type (e.g. Floor → Curtains). */
export function reassignRowToZoneType(
  row: SimpleZoneRow,
  zoneId: string,
  category: RoomCategory,
  catalogs: Catalog[],
  existingScene?: SceneRecord
): SimpleZoneRow | null {
  const q = getZoneQuestionById(category, zoneId);
  if (!q) return null;
  const nextPalette = q.palette;
  const nextCatalogs = defaultCatalogIdsForPalette(catalogs, nextPalette);
  // Prefer keeping catalogs that still match the new palette.
  const kept = row.catalogIds.filter((id) => nextCatalogs.includes(id));
  const targetExisted = Boolean(existingScene?.zones.some((z) => z.id === q.id));
  return {
    ...row,
    id: q.id,
    kind: "single",
    labelKey: q.labelKey,
    label: "",
    palette: nextPalette,
    sectionKey: q.sectionKey,
    optional: q.optional,
    catalogIds: kept.length ? kept : nextCatalogs,
    // Only "keep existing" if the *new* zone id already has files on disk.
    existedBefore: targetExisted,
  };
}

export function syncRowCatalogsForPalette(
  row: SimpleZoneRow,
  palette: ZonePalette,
  catalogs: Catalog[]
): SimpleZoneRow {
  const matching = defaultCatalogIdsForPalette(catalogs, palette);
  const kept = row.catalogIds.filter((id) => matching.includes(id));
  return {
    ...row,
    palette,
    catalogIds: kept.length ? kept : matching,
  };
}

/** Clear a mistaken upload; restore existing mask preview when editing a saved zone. */
export function clearRowUpload(
  row: SimpleZoneRow,
  existingScene?: SceneRecord
): SimpleZoneRow {
  if (row.existedBefore && existingScene && row.id) {
    return {
      ...row,
      source: {
        file: null,
        url: "",
        preview: `/scenes/${existingScene.id}/mask-${row.id}.png`,
        mode: "upload",
      },
    };
  }
  return { ...row, source: emptyImageSource() };
}

export function rowHasClearableUpload(row: SimpleZoneRow): boolean {
  return Boolean(row.source.file || row.source.url);
}
