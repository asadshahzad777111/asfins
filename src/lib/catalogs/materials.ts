import type { Catalog, CatalogSwatch } from "./types";
import type { ZonePalette } from "@/lib/scenes/types";

export interface CatalogMaterial {
  catalogId: string;
  catalogName: string;
  swatch: CatalogSwatch;
}

/** Catalogs that have at least one swatch for the given zone palette. */
export function catalogsForPalette(catalogs: Catalog[], palette: ZonePalette): Catalog[] {
  return catalogs.filter((c) => c.swatches.some((s) => s.palette === palette));
}

/** Default catalog IDs for a zone palette, preferring scene-linked catalogs when provided. */
export function defaultCatalogIdsForPalette(
  catalogs: Catalog[],
  palette: ZonePalette,
  sceneCatalogIds?: string[]
): string[] {
  const matching = catalogsForPalette(catalogs, palette);
  if (sceneCatalogIds?.length) {
    const linked = matching.filter((c) => sceneCatalogIds.includes(c.id) || c.global);
    if (linked.length) return linked.map((c) => c.id);
  }
  return matching.map((c) => c.id);
}

export function flattenCatalogMaterials(catalogs: Catalog[]): CatalogMaterial[] {
  const items: CatalogMaterial[] = [];
  for (const catalog of catalogs) {
    if (!catalog.global) continue;
    for (const swatch of catalog.swatches) {
      items.push({
        catalogId: catalog.id,
        catalogName: catalog.companyName,
        swatch,
      });
    }
  }
  return items;
}

export function findCatalogMaterial(
  catalogs: Catalog[],
  catalogId: string,
  swatchId: string
): CatalogMaterial | null {
  const catalog = catalogs.find((c) => c.id === catalogId);
  if (!catalog) return null;
  const swatch = catalog.swatches.find((s) => s.id === swatchId);
  if (!swatch) return null;
  return { catalogId: catalog.id, catalogName: catalog.companyName, swatch };
}

const BASE_COLOR_SUGGESTIONS = [
  "Orange",
  "Red",
  "Brown",
  "Walnut",
  "Oak",
  "Teak",
  "White",
  "Grey",
  "Black",
  "Green",
  "Blue",
  "Beige",
  "Cream",
  "Charcoal",
  "Mahogany",
  "Marble",
];

/** Unique colour suggestions from all catalogs + common names. */
export function collectColorSuggestions(catalogs: Catalog[]): string[] {
  const set = new Set<string>(BASE_COLOR_SUGGESTIONS);
  for (const catalog of catalogs) {
    for (const sw of catalog.swatches) {
      if (sw.colorDescription?.trim()) set.add(sw.colorDescription.trim());
      if (sw.name?.trim()) {
        const first = sw.name.trim().split(/\s+/)[0];
        if (first.length > 2) set.add(first);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
