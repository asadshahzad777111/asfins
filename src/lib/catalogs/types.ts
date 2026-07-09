export interface CatalogSwatch {
  id: string;
  name: string;
  hex: string;
  sheetCode: string;
  pricePKR?: number;
  palette: "wood" | "paint" | "tile";
  /** External texture image URL (Blogger, CDN, Strapi, etc.) */
  imageUrl?: string;
  /** Small local thumb for fast catalog grid (e.g. /catalog-textures/zrk/thumbs/2030.webp) */
  thumbUrl?: string;
  /** ZRK-style product detail fields */
  materialCategory?: string;
  surfaceFinish?: string;
  /** Colour tone e.g. Orange, Walnut — autocomplete in admin */
  colorDescription?: string;
  dimensions?: string;
  thickness?: string;
  description?: string;
  idealApplications?: string;
  technicalSheetUrl?: string;
}

export interface Catalog {
  id: string;
  companyName: string;
  swatches: CatalogSwatch[];
  global: boolean;
  createdAt: string;
}

export interface CatalogRegistry {
  catalogs: Catalog[];
}
