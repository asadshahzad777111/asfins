import {
  detectAlphaPolarity,
  isMaskPixelInside,
  layerHasAlphaVariation,
  type AlphaPolarity,
} from "@/lib/images/mask-alpha";
import {
  galleryTextureCrop,
  type TextureCropRect,
} from "@/lib/canvas/texture-crop";

const MASK_CUTOFF = 0.5;
type MaskMode = "alpha" | "luminance";

/** Overlap adjacent tiles so AA / edge pixels never leave a 1px gap. */
const TILE_OVERLAP_PX = 2;

function detectMaskModeAndPolarity(data: Uint8ClampedArray): {
  mode: MaskMode;
  polarity: AlphaPolarity;
} {
  const total = data.length / 4;
  if (layerHasAlphaVariation(data, total)) {
    return { mode: "alpha", polarity: detectAlphaPolarity(data, total) };
  }
  return { mode: "luminance", polarity: "opaque-zone" };
}

function maskIsInside(
  r: number,
  g: number,
  b: number,
  a: number,
  mode: MaskMode,
  polarity: AlphaPolarity
): boolean {
  if (mode === "alpha") return isMaskPixelInside(a, polarity);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum >= MASK_CUTOFF;
}

/**
 * Physical laminate sheet: 8 ft × 4 ft (2440×1220 mm) → aspect 2:1.
 * Scenes have no metric scale. Assume the photo's vertical axis is a typical
 * floor-to-ceiling height (~11 ft), derive pixels-per-foot, then size one tile
 * as one physical sheet × 0.66 (~34% smaller) so grain reads finer across a run.
 */
const ROOM_HEIGHT_FT = 11;
const SHEET_LONG_FT = 8;
const SHEET_SHORT_FT = 4;
/** Scale sheets down ~34% vs full ppf; keep mid-size clamps (8 ft ≈ 115–307 px). */
const MIN_PPF = 24;
const MAX_PPF = 64;
const TILE_SCALE = 0.66;

/** Integer tile size — fractional drawImage destinations create seam lines. */
export function computeTextureTileSize(
  textureW: number,
  textureH: number,
  canvasW: number,
  canvasH: number
): { tileW: number; tileH: number } {
  const sceneH = Math.max(canvasH, 1);
  const ppf =
    Math.min(MAX_PPF, Math.max(MIN_PPF, sceneH / ROOM_HEIGHT_FT)) * TILE_SCALE;
  const sheetLongPx = Math.max(40, Math.floor(SHEET_LONG_FT * ppf));
  const sheetShortPx = Math.max(20, Math.floor(SHEET_SHORT_FT * ppf));

  // Landscape source → 8 ft along X; otherwise portrait (common on cabinet faces).
  const srcLandscape = textureW > textureH * 1.1;
  if (srcLandscape) {
    return { tileW: sheetLongPx, tileH: sheetShortPx };
  }
  return { tileW: sheetShortPx, tileH: sheetLongPx };
}

/**
 * Bake one tile, then force opposite edges to match.
 * Stops createPattern / tile joins from showing a bright AA hairline
 * when the source swatch is not perfectly seamless (common for solid hex webps).
 */
function bakeSealedTile(
  texture: HTMLImageElement,
  tileW: number,
  tileH: number,
  crop: TextureCropRect | null
): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = tileW;
  tile.height = tileH;
  const tileCtx = tile.getContext("2d", { willReadFrequently: true })!;
  tileCtx.imageSmoothingEnabled = true;
  tileCtx.imageSmoothingQuality = "high";
  if (crop) {
    tileCtx.drawImage(
      texture,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      tileW,
      tileH
    );
  } else {
    tileCtx.drawImage(texture, 0, 0, tileW, tileH);
  }

  // Mirror a few edge pixels so overlapped joins match (solid hex webps
  // often have compression noise on the border that reads as a seam line).
  const seal = Math.min(TILE_OVERLAP_PX, Math.floor(tileW / 4), Math.floor(tileH / 4));
  if (seal >= 1 && tileW > seal * 2 && tileH > seal * 2) {
    const leftStrip = tileCtx.getImageData(0, 0, seal, tileH);
    tileCtx.putImageData(leftStrip, tileW - seal, 0);
    const topStrip = tileCtx.getImageData(0, 0, tileW, seal);
    tileCtx.putImageData(topStrip, 0, tileH - seal);
  }

  return tile;
}

/**
 * Fill with opaque overlapping tiles at integer coords.
 * createPattern('repeat') still leaves 1px AA gaps on many browsers —
 * especially visible on near-solid charcoal swatches and large scenes.
 */
function drawTiledTexture(
  ctx: CanvasRenderingContext2D,
  texture: HTMLImageElement,
  width: number,
  height: number,
  textureUrl?: string
): void {
  const fullW = texture.naturalWidth || texture.width;
  const fullH = texture.naturalHeight || texture.height;
  if (fullW < 1 || fullH < 1) return;

  const crop = textureUrl ? galleryTextureCrop(textureUrl, fullW, fullH) : null;
  const srcW = crop?.sw ?? fullW;
  const srcH = crop?.sh ?? fullH;

  const { tileW, tileH } = computeTextureTileSize(srcW, srcH, width, height);
  const tile = bakeSealedTile(texture, tileW, tileH, crop);

  const stepX = Math.max(1, tileW - TILE_OVERLAP_PX);
  const stepY = Math.max(1, tileH - TILE_OVERLAP_PX);

  ctx.save();
  // Integer blits only — smoothing here reintroduces soft gaps at joins.
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      ctx.drawImage(tile, x, y);
    }
  }

  // Guarantee right / bottom coverage when the last step undershoots.
  const lastX = Math.max(0, width - tileW);
  const lastY = Math.max(0, height - tileH);
  if (lastX % stepX !== 0) {
    for (let y = 0; y < height; y += stepY) {
      ctx.drawImage(tile, lastX, y);
    }
  }
  if (lastY % stepY !== 0) {
    for (let x = 0; x < width; x += stepX) {
      ctx.drawImage(tile, x, lastY);
    }
  }
  if (lastX % stepX !== 0 || lastY % stepY !== 0) {
    ctx.drawImage(tile, lastX, lastY);
  }

  ctx.restore();
}

function buildClipAlpha(mask: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(mask, 0, 0, width, height);
  const maskPx = ctx.getImageData(0, 0, width, height);
  const { mode, polarity } = detectMaskModeAndPolarity(maskPx.data);
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < maskPx.data.length; i += 4) {
    const inside = maskIsInside(
      maskPx.data[i],
      maskPx.data[i + 1],
      maskPx.data[i + 2],
      maskPx.data[i + 3],
      mode,
      polarity
    );
    if (inside) {
      out.data[i] = 255;
      out.data[i + 1] = 255;
      out.data[i + 2] = 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function readImageData(source: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** Apply a texture sheet (URL image) inside the mask — fast GPU compositing. */
export function textureizeMask(
  mask: CanvasImageSource,
  texture: HTMLImageElement,
  width: number,
  height: number,
  glossy: boolean,
  luminanceSource?: CanvasImageSource,
  textureUrl?: string
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d")!;

  drawTiledTexture(ctx, texture, width, height, textureUrl ?? texture.src);

  if (luminanceSource) {
    const basePx = readImageData(luminanceSource, width, height);
    const texPx = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < texPx.data.length; i += 4) {
      const baseLum =
        (0.299 * basePx.data[i] + 0.587 * basePx.data[i + 1] + 0.114 * basePx.data[i + 2]) /
        255;
      const factor = 0.78 + 0.22 * baseLum;
      texPx.data[i] = Math.min(255, Math.round(texPx.data[i] * factor));
      texPx.data[i + 1] = Math.min(255, Math.round(texPx.data[i + 1] * factor));
      texPx.data[i + 2] = Math.min(255, Math.round(texPx.data[i + 2] * factor));
    }
    ctx.putImageData(texPx, 0, 0);
  }

  const clip = buildClipAlpha(mask, width, height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(clip, 0, 0);

  if (glossy) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.min(255, d[i] * 1.06);
      d[i + 1] = Math.min(255, d[i + 1] * 1.06);
      d[i + 2] = Math.min(255, d[i + 2] * 1.06);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return off;
}
