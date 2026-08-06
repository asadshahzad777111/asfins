import type { CatalogSwatch } from "@/lib/catalogs/types";
import type { Product } from "@/lib/products/types";

export const ZRK_CATALOG_ID = "zrk-group";
export const DEFAULT_DIMENSIONS = "2440*1220";
export const DEFAULT_THICKNESS = "16mm";

export interface ZrkBulkRow {
  sheetCode: string;
  name: string;
  imageUrl: string;
  thumbUrl?: string;
  surfaceFinish?: string;
  colorDescription?: string;
  materialCategory?: string;
  dimensions?: string;
  thickness?: string;
  pricePKR?: number;
}

export interface ZrkBulkImportResult {
  added: number;
  updated: number;
  errors: string[];
  sheetCodes: string[];
}

function cleanCode(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

/** Parse pasted bulk lines — flexible separators (| , tab). */
export function parseZrkBulkText(text: string): { rows: ZrkBulkRow[]; errors: string[] } {
  const rows: ZrkBulkRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line
      .split(/\s*[|,|\t]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    const urlIdx = parts.findIndex((p) => /^https?:\/\//i.test(p));
    if (parts.length < 3 || urlIdx < 0) {
      errors.push(`Line ${i + 1}: need code, name, and image URL`);
      continue;
    }

    const sheetCode = cleanCode(parts[0]);
    const name = parts[1];
    const imageUrl = parts[urlIdx];
    const rest = parts.filter((_, idx) => idx !== 0 && idx !== 1 && idx !== urlIdx);

    if (!sheetCode || !name) {
      errors.push(`Line ${i + 1}: missing code or name`);
      continue;
    }

    rows.push({
      sheetCode,
      name,
      imageUrl,
      surfaceFinish: rest[0],
      colorDescription: rest[1],
      materialCategory: rest[2] ?? "Textured Laminates",
      pricePKR: rest[3] ? Number(rest[3]) || 0 : 0,
    });
  }

  return { rows, errors };
}

function fallbackHex(color?: string): string {
  if (!color) return "#5C5C5C";
  const c = color.toLowerCase();
  const map: Record<string, string> = {
    orange: "#E86A2A",
    red: "#8B2E2E",
    brown: "#6B3A2A",
    white: "#F5F0E8",
    grey: "#9A9A9A",
    gray: "#9A9A9A",
    black: "#2A2A2A",
    green: "#4A6B4A",
    blue: "#3A4A6B",
    beige: "#D4C4A8",
    walnut: "#5C4033",
    oak: "#C4A574",
  };
  for (const [key, hex] of Object.entries(map)) {
    if (c.includes(key)) return hex;
  }
  return "#5C5C5C";
}

export function zrkRowToSwatch(row: ZrkBulkRow): CatalogSwatch {
  const id = `zrk-${row.sheetCode}`;
  const color = row.colorDescription;
  const materialCategory = row.materialCategory ?? "Textured Laminates";
  const desc =
    row.surfaceFinish && color
      ? `A ${materialCategory} product with a ${row.surfaceFinish} surface, featuring a ${color} color tone.`
      : undefined;

  const isLamination = /lamination\s*series/i.test(materialCategory);
  const substrate = isLamination ? ("mdf" as const) : undefined;

  return {
    id,
    name: row.name,
    hex: fallbackHex(color),
    sheetCode: row.sheetCode,
    pricePKR: row.pricePKR ?? 0,
    palette: "wood",
    imageUrl: row.imageUrl,
    thumbUrl: row.thumbUrl,
    materialCategory,
    surfaceFinish: row.surfaceFinish,
    colorDescription: color,
    dimensions: row.dimensions ?? DEFAULT_DIMENSIONS,
    thickness: row.thickness ?? DEFAULT_THICKNESS,
    description: desc,
    idealApplications: "Kitchen cabinets, wardrobes",
    substrate: substrate ?? null,
  };
}

export function zrkRowToProduct(row: ZrkBulkRow, swatch: CatalogSwatch): Product {
  const category =
    row.materialCategory?.toLowerCase().includes("marble") ? "marble" : "wood-laminate";

  return {
    id: swatch.id,
    name: row.name,
    pricePKR: row.pricePKR ?? 0,
    image: row.imageUrl ?? row.thumbUrl,
    category,
    description: swatch.description ?? `${row.name} — ZRK Group laminate.`,
    active: true,
    createdAt: new Date().toISOString(),
    productCode: row.sheetCode,
    surfaceFinish: row.surfaceFinish,
    colorDescription: row.colorDescription,
    dimensions: row.dimensions ?? DEFAULT_DIMENSIONS,
    thickness: row.thickness ?? DEFAULT_THICKNESS,
    idealApplications: "Kitchen Cabinets",
    brandName: "ZRK Group",
    materialCategory: swatch.materialCategory,
    substrate: swatch.substrate ?? null,
    stock: swatch.stock,
    lowStockAt: swatch.lowStockAt,
  };
}

export async function importZrkBulkRows(
  rows: ZrkBulkRow[],
  deps: {
    getCatalog: (id: string) => Promise<{ id: string; companyName: string; swatches: CatalogSwatch[]; global: boolean; createdAt: string } | undefined>;
    saveCatalog: (catalog: {
      id: string;
      companyName: string;
      swatches: CatalogSwatch[];
      global: boolean;
      createdAt: string;
    }) => Promise<void>;
    getProduct: (id: string) => Promise<Product | undefined>;
    saveProduct: (product: Product) => Promise<void>;
  }
): Promise<ZrkBulkImportResult> {
  const catalog = await deps.getCatalog(ZRK_CATALOG_ID);
  if (!catalog) {
    return { added: 0, updated: 0, errors: ["ZRK Group catalog not found"], sheetCodes: [] };
  }

  let added = 0;
  let updated = 0;
  const errors: string[] = [];
  const sheetCodes: string[] = [];
  const swatches = [...catalog.swatches];

  for (const row of rows) {
    try {
      const swatch = zrkRowToSwatch(row);
      const product = zrkRowToProduct(row, swatch);
      const idx = swatches.findIndex(
        (s) => s.id === swatch.id || s.sheetCode === swatch.sheetCode
      );

      if (idx >= 0) {
        swatches[idx] = { ...swatches[idx], ...swatch };
        updated++;
      } else {
        swatches.push(swatch);
        added++;
      }

      const existing = await deps.getProduct(product.id);
      if (existing) {
        await deps.saveProduct({
          ...existing,
          ...product,
          createdAt: existing.createdAt,
          pricePKR: row.pricePKR && row.pricePKR > 0 ? row.pricePKR : existing.pricePKR,
        });
      } else {
        await deps.saveProduct(product);
      }

      sheetCodes.push(row.sheetCode);
    } catch (e) {
      errors.push(`${row.sheetCode}: ${(e as Error).message}`);
    }
  }

  await deps.saveCatalog({ ...catalog, swatches });
  return { added, updated, errors, sheetCodes };
}
