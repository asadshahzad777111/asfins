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
 * True for main Patex sheet photos (logo + optional NEW ARRIVAL chrome).
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

function isYellowChrome(r: number, g: number, b: number): boolean {
  return r > 170 && g > 140 && b < 130 && r + g > 2.1 * b;
}

function isRedBanner(r: number, g: number, b: number): boolean {
  // Bright corner ribbon — not dark red laminate grain.
  return r > 200 && g < 75 && b < 75 && r - g > 110 && r - b > 110;
}

/**
 * Scan a downscaled preview for Patex logo / NEW ARRIVAL / white footer and
 * return a crop in full-image coordinates. Only crops what chrome actually
 * occupies — avoids cutting usable colour with a fixed bottom strip.
 */
export function detectPatexChromeCrop(
  texture: CanvasImageSource,
  srcW: number,
  srcH: number
): TextureCropRect | null {
  if (srcW < 8 || srcH < 8) return null;

  const probeW = 64;
  const probeH = Math.max(8, Math.round((probeW * srcH) / srcW));
  const probe = document.createElement("canvas");
  probe.width = probeW;
  probe.height = probeH;
  const pctx = probe.getContext("2d", { willReadFrequently: true })!;
  pctx.drawImage(texture, 0, 0, probeW, probeH);
  const { data } = pctx.getImageData(0, 0, probeW, probeH);

  let chromeMaxY = -1;
  let yellowHits = 0;
  const topLimit = Math.floor(probeH * 0.32);
  const leftLogoX = Math.floor(probeW * 0.45);
  for (let y = 0; y < topLimit; y++) {
    for (let x = 0; x < probeW; x++) {
      const i = (y * probeW + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Yellow hex logo lives top-left — don't treat warm wood as chrome.
      if (x <= leftLogoX && isYellowChrome(r, g, b)) {
        yellowHits++;
        chromeMaxY = Math.max(chromeMaxY, y);
      }
    }
  }

  // Red "NEW ARRIVAL" ribbon — only when the sheet body is not itself red
  // (otherwise dark/bright red laminates flood the detector).
  if (yellowHits >= 8) {
    let bodyRed = 0;
    let bodyN = 0;
    for (let y = Math.floor(probeH * 0.4); y < Math.floor(probeH * 0.6); y++) {
      for (let x = 0; x < probeW; x++) {
        const i = (y * probeW + x) * 4;
        bodyN++;
        if (isRedBanner(data[i], data[i + 1], data[i + 2])) bodyRed++;
      }
    }
    if (bodyRed / Math.max(1, bodyN) < 0.08) {
      let redHits = 0;
      let redMaxY = -1;
      for (let y = 0; y < topLimit; y++) {
        for (let x = leftLogoX; x < probeW; x++) {
          const i = (y * probeW + x) * 4;
          if (isRedBanner(data[i], data[i + 1], data[i + 2])) {
            redHits++;
            redMaxY = Math.max(redMaxY, y);
          }
        }
      }
      if (redHits >= 6) chromeMaxY = Math.max(chromeMaxY, redMaxY);
    }
  }

  // Mid-body pale fraction — white laminates look "pale" everywhere; skip footer.
  let midPale = 0;
  let midN = 0;
  const midY0 = Math.floor(probeH * 0.4);
  const midY1 = Math.floor(probeH * 0.6);
  for (let y = midY0; y < midY1; y++) {
    for (let x = 0; x < probeW; x++) {
      const i = (y * probeW + x) * 4;
      midN++;
      if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) midPale++;
    }
  }
  const midPaleFrac = midPale / Math.max(1, midN);

  // White footer only when the body itself is not a white/ivory sheet.
  let whiteBottomRows = 0;
  if (midPaleFrac < 0.45) {
    for (let y = probeH - 1; y >= Math.floor(probeH * 0.7); y--) {
      let pale = 0;
      for (let x = 0; x < probeW; x++) {
        const i = (y * probeW + x) * 4;
        if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) pale++;
      }
      if (pale / probeW >= 0.72) whiteBottomRows++;
      else break;
    }
  }

  const scaleY = srcH / probeH;
  let top = 0;
  if (yellowHits >= 8 && chromeMaxY >= 0) {
    // Clear logo/banner + small pad; clamp so we never eat most of the sheet.
    top = Math.min(
      Math.round(srcH * 0.2),
      Math.max(Math.round(srcH * 0.04), Math.round((chromeMaxY + 3) * scaleY))
    );
  } else {
    // Fallback for Patex product shots when probe misses yellow (compression).
    top = Math.round(srcH * 0.12);
  }

  const bottom =
    whiteBottomRows >= 2
      ? Math.min(Math.round(srcH * 0.14), Math.round(whiteBottomRows * scaleY))
      : 0;

  const sh = Math.max(1, srcH - top - bottom);
  if (top <= 0 && bottom <= 0) return null;
  return { sx: 0, sy: top, sw: srcW, sh };
}

/**
 * Studio/apply crop for a texture URL. Patex product photos get chrome removed;
 * Elegance / other catalogs stay full-frame.
 */
export function galleryTextureCrop(
  url: string,
  srcW: number,
  srcH: number,
  texture?: CanvasImageSource | null
): TextureCropRect | null {
  if (srcW < 8 || srcH < 8) return null;
  if (!isPatexProductTextureUrl(url)) return null;

  if (texture) {
    return detectPatexChromeCrop(texture, srcW, srcH);
  }

  // Sync fallback (no pixels): logo band only — do not invent a bottom crop.
  const top = Math.round(srcH * 0.12);
  return { sx: 0, sy: top, sw: srcW, sh: Math.max(1, srcH - top) };
}
