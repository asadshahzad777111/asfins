/**
 * Crop baked-in catalog chrome (Patex logo / NEW ARRIVAL banner, white margins)
 * when tiling textures onto the gallery canvas. Product listing still uses full images.
 */

export type TextureCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/**
 * True for main Patex sheet photos (logo + NEW ARRIVAL chrome).
 * Patex Elegance PDF tiles are already clean edge-to-edge crops — no gallery crop.
 */
export function isPatexProductTextureUrl(url: string): boolean {
  try {
    const decoded = decodeURIComponent(url);
    return /catalog-textures\/patex\//i.test(decoded) && !/patex-elegance/i.test(decoded);
  } catch {
    return /catalog-textures\/patex\//i.test(url) && !/patex-elegance/i.test(url);
  }
}

/**
 * Patex product shots are portrait with:
 * - top strip: brand logo + red "NEW ARRIVAL" corner banner
 * - bottom strip: white footer margin
 */
export function galleryTextureCrop(
  url: string,
  srcW: number,
  srcH: number
): TextureCropRect | null {
  if (srcW < 8 || srcH < 8) return null;
  if (!isPatexProductTextureUrl(url)) return null;

  const top = Math.round(srcH * 0.145);
  const bottom = Math.round(srcH * 0.11);
  const sh = Math.max(1, srcH - top - bottom);
  return { sx: 0, sy: top, sw: srcW, sh };
}
