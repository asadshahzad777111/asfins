export const BRANDS = {
  zrk: {
    name: "ZRK",
    logo: "https://zrkgroup.com/logo/logo.png",
    alt: "ZRK Group",
  },
} as const;

export type BrandKey = keyof typeof BRANDS;

export function getBrandLogo(brandName?: string): { src: string; alt: string } | null {
  if (!brandName) return null;
  const normalized = brandName.toLowerCase();
  if (normalized.includes("zrk")) {
    return { src: BRANDS.zrk.logo, alt: BRANDS.zrk.alt };
  }
  const key = normalized as BrandKey;
  const brand = BRANDS[key];
  if (!brand) return null;
  return { src: brand.logo, alt: brand.alt };
}

/** Show partner logo next to catalog / company name when applicable */
export function getCatalogBrandLogo(companyName?: string): { src: string; alt: string } | null {
  if (!companyName) return null;
  return getBrandLogo(companyName);
}
