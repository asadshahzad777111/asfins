import type { Product } from "./types";
import { isSheetCategory } from "./categories";

export type ShopCatalogFolder = {
  id: string;
  /** Brand for logo lookup */
  brandName: string;
  /** Series / line e.g. UV Lux */
  series: string;
  /** Card title e.g. "ZRK · UV Lux" */
  label: string;
  count: number;
  previewUrl?: string;
};

function slugPart(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other"
  );
}

export function productCatalogId(p: Product): string {
  const brand = (p.brandName || "Other").trim();
  const series = (p.materialCategory || "General").trim();
  return `${slugPart(brand)}__${slugPart(series)}`;
}

export function productCatalogLabel(p: Product): string {
  const brand = (p.brandName || "Other").trim();
  const series = (p.materialCategory || "").trim();
  if (!series) return brand;
  // Avoid "Patex Elegance · Patex Elegance"
  if (series.toLowerCase() === brand.toLowerCase()) return brand;
  if (series.toLowerCase().includes(brand.toLowerCase().replace(/\s*group\s*$/i, "").trim())) {
    return series;
  }
  const shortBrand = brand.replace(/\s*Group\s*$/i, "").trim();
  return `${shortBrand} · ${series}`;
}

/** Sheet catalogs grouped by brand + series (UV Lux, Patex, Patex Elegance, …). */
export function buildSheetCatalogFolders(products: Product[]): ShopCatalogFolder[] {
  const map = new Map<string, ShopCatalogFolder>();

  for (const p of products) {
    if (!isSheetCategory(p.category)) continue;
    const id = productCatalogId(p);
    const existing = map.get(id);
    if (existing) {
      existing.count += 1;
      if (!existing.previewUrl && p.image) existing.previewUrl = p.image;
      continue;
    }
    map.set(id, {
      id,
      brandName: (p.brandName || "Other").trim(),
      series: (p.materialCategory || "General").trim(),
      label: productCatalogLabel(p),
      count: 1,
      previewUrl: p.image,
    });
  }

  const preferredOrder = [
    /uv\s*lux/i,
    /high\s*gloss\s*elite/i,
    /lamination\s*series/i,
    /textured/i,
    /syncron/i,
    /patex\s*elegance/i,
    /patex/i,
  ];

  return [...map.values()].sort((a, b) => {
    const ai = preferredOrder.findIndex((re) => re.test(a.label) || re.test(a.series));
    const bi = preferredOrder.findIndex((re) => re.test(b.label) || re.test(b.series));
    const aRank = ai === -1 ? 99 : ai;
    const bRank = bi === -1 ? 99 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.label.localeCompare(b.label);
  });
}

export function productInCatalog(p: Product, catalogId: string): boolean {
  return productCatalogId(p) === catalogId;
}
