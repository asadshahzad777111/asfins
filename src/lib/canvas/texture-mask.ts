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
 * as one physical sheet × 0.79 (~21% smaller) so grain reads finer across a run.
 */
const ROOM_HEIGHT_FT = 11;
const SHEET_LONG_FT = 8;
const SHEET_SHORT_FT = 4;
/** Scale sheets down ~21% vs full ppf; keep mid-size clamps (8 ft ≈ 115–307 px). */
const MIN_PPF = 24;
const MAX_PPF = 64;
const TILE_SCALE = 0.79;

/** Integer tile size — fractional drawImage destinations create seam lines. */
export function computeTextureTileSize(
  textureW: number,
  textureH: number,
  canvasW: number,
  canvasH: number,
  /** <1 → finer grain (textured series). */
  scale = 1
): { tileW: number; tileH: number } {
  const sceneH = Math.max(canvasH, 1);
  const ppf =
    Math.min(MAX_PPF, Math.max(MIN_PPF, sceneH / ROOM_HEIGHT_FT)) *
    TILE_SCALE *
    Math.max(0.55, Math.min(1.25, scale));
  const sheetLongPx = Math.max(40, Math.floor(SHEET_LONG_FT * ppf));
  const sheetShortPx = Math.max(20, Math.floor(SHEET_SHORT_FT * ppf));

  // Landscape source → 8 ft along X; otherwise portrait (common on cabinet faces).
  const srcLandscape = textureW > textureH * 1.1;
  if (srcLandscape) {
    return { tileW: sheetLongPx, tileH: sheetShortPx };
  }
  return { tileW: sheetShortPx, tileH: sheetLongPx };
}

type BookMatchAxes = { leftRight: boolean; topBottom: boolean };

/**
 * Detect book-matched (mirrored) seamless sheets — same idea as
 * `demirror-texture.ts`, but on a canvas probe so studio can tile with
 * alternating flips instead of showing the center mirror fold as a seam.
 */
function detectBookMatchAxes(
  texture: HTMLImageElement,
  crop: TextureCropRect
): BookMatchAxes {
  const probeW = 64;
  const probeH = 64;
  const probe = document.createElement("canvas");
  probe.width = probeW;
  probe.height = probeH;
  const pctx = probe.getContext("2d", { willReadFrequently: true })!;
  pctx.drawImage(
    texture,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    probeW,
    probeH
  );
  const { data } = pctx.getImageData(0, 0, probeW, probeH);
  const pixels = data.length / 4;

  let mean = 0;
  for (let i = 0; i < data.length; i += 4) {
    mean += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  mean /= pixels;

  let varSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
    varSum += (v - mean) ** 2;
  }
  const std = Math.sqrt(varSum / pixels);

  const mid = Math.floor(probeW / 2);
  const midY = Math.floor(probeH / 2);

  let lrSum = 0;
  let lrN = 0;
  for (let y = 0; y < probeH; y++) {
    for (let x = 0; x < mid; x++) {
      const li = (y * probeW + x) * 4;
      const ri = (y * probeW + (probeW - 1 - x)) * 4;
      lrSum +=
        (Math.abs(data[li] - data[ri]) +
          Math.abs(data[li + 1] - data[ri + 1]) +
          Math.abs(data[li + 2] - data[ri + 2])) /
        3;
      lrN++;
    }
  }

  let tbSum = 0;
  let tbN = 0;
  for (let y = 0; y < midY; y++) {
    for (let x = 0; x < probeW; x++) {
      const ti = (y * probeW + x) * 4;
      const bi = ((probeH - 1 - y) * probeW + x) * 4;
      tbSum +=
        (Math.abs(data[ti] - data[bi]) +
          Math.abs(data[ti + 1] - data[bi + 1]) +
          Math.abs(data[ti + 2] - data[bi + 2])) /
        3;
      tbN++;
    }
  }

  const lr = lrSum / Math.max(1, lrN);
  const tb = tbSum / Math.max(1, tbN);
  const threshold = Math.max(10, std * 0.9);
  // Near-solid swatches always "match" themselves — skip those.
  const textured = std >= 8;

  return {
    leftRight: textured && lr < threshold,
    topBottom: textured && tb < threshold,
  };
}

/**
 * Bake one tile from a source rect. Optionally seal opposite edges for
 * non-bookmatched sources (solid hex webps with noisy borders).
 */
function bakeTile(
  texture: HTMLImageElement,
  tileW: number,
  tileH: number,
  src: TextureCropRect,
  sealEdges: boolean
): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = tileW;
  tile.height = tileH;
  const tileCtx = tile.getContext("2d", { willReadFrequently: true })!;
  tileCtx.imageSmoothingEnabled = true;
  tileCtx.imageSmoothingQuality = "high";
  tileCtx.drawImage(
    texture,
    src.sx,
    src.sy,
    src.sw,
    src.sh,
    0,
    0,
    tileW,
    tileH
  );

  if (sealEdges) {
    const seal = Math.min(
      TILE_OVERLAP_PX,
      Math.floor(tileW / 4),
      Math.floor(tileH / 4)
    );
    if (seal >= 1 && tileW > seal * 2 && tileH > seal * 2) {
      const leftStrip = tileCtx.getImageData(0, 0, seal, tileH);
      tileCtx.putImageData(leftStrip, tileW - seal, 0);
      const topStrip = tileCtx.getImageData(0, 0, tileW, seal);
      tileCtx.putImageData(topStrip, 0, tileH - seal);
    }
  }

  return tile;
}

function blitTile(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  x: number,
  y: number,
  flipX: boolean,
  flipY: boolean
): void {
  if (!flipX && !flipY) {
    ctx.drawImage(tile, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x + (flipX ? tile.width : 0), y + (flipY ? tile.height : 0));
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(tile, 0, 0);
  ctx.restore();
}

/**
 * Fill with opaque overlapping tiles at integer coords.
 * Book-matched sheets use natural-grain cells + alternating flips so the
 * center mirror fold never appears as a sheet join.
 */
function drawTiledTexture(
  ctx: CanvasRenderingContext2D,
  texture: HTMLImageElement,
  width: number,
  height: number,
  textureUrl?: string,
  textureScale = 1
): void {
  const fullW = texture.naturalWidth || texture.width;
  const fullH = texture.naturalHeight || texture.height;
  if (fullW < 1 || fullH < 1) return;

  const chromeCrop = textureUrl
    ? galleryTextureCrop(textureUrl, fullW, fullH, texture)
    : null;
  const base: TextureCropRect = chromeCrop ?? {
    sx: 0,
    sy: 0,
    sw: fullW,
    sh: fullH,
  };

  // Sheet size from the full (chrome-cropped) frame so physical scale stays stable.
  const sheetSize = computeTextureTileSize(
    base.sw,
    base.sh,
    width,
    height,
    textureScale
  );

  const axes = detectBookMatchAxes(texture, base);
  const src: TextureCropRect = {
    sx: base.sx,
    sy: base.sy,
    sw: axes.leftRight ? Math.max(1, Math.floor(base.sw / 2)) : base.sw,
    sh: axes.topBottom ? Math.max(1, Math.floor(base.sh / 2)) : base.sh,
  };

  // Natural-grain cell is half a book-matched sheet on mirrored axes.
  const tileW = axes.leftRight
    ? Math.max(20, Math.floor(sheetSize.tileW / 2))
    : sheetSize.tileW;
  const tileH = axes.topBottom
    ? Math.max(20, Math.floor(sheetSize.tileH / 2))
    : sheetSize.tileH;

  const bookMatched = axes.leftRight || axes.topBottom;
  const tile = bakeTile(texture, tileW, tileH, src, !bookMatched);

  // Book-match flips already meet edge-to-edge; overlap would double-draw.
  const overlap = bookMatched ? 0 : TILE_OVERLAP_PX;
  const stepX = Math.max(1, tileW - overlap);
  const stepY = Math.max(1, tileH - overlap);

  ctx.save();
  // Integer blits only — smoothing here reintroduces soft gaps at joins.
  ctx.imageSmoothingEnabled = false;

  for (let y = 0, row = 0; y < height; y += stepY, row++) {
    for (let x = 0, col = 0; x < width; x += stepX, col++) {
      const flipX = bookMatched && axes.leftRight && col % 2 === 1;
      const flipY = bookMatched && axes.topBottom && row % 2 === 1;
      blitTile(ctx, tile, x, y, flipX, flipY);
    }
  }

  // Guarantee right / bottom coverage when the last step undershoots.
  const lastX = Math.max(0, width - tileW);
  const lastY = Math.max(0, height - tileH);
  if (lastX % stepX !== 0) {
    const col = Math.floor(lastX / stepX);
    for (let y = 0, row = 0; y < height; y += stepY, row++) {
      blitTile(
        ctx,
        tile,
        lastX,
        y,
        bookMatched && axes.leftRight && col % 2 === 1,
        bookMatched && axes.topBottom && row % 2 === 1
      );
    }
  }
  if (lastY % stepY !== 0) {
    const row = Math.floor(lastY / stepY);
    for (let x = 0, col = 0; x < width; x += stepX, col++) {
      blitTile(
        ctx,
        tile,
        x,
        lastY,
        bookMatched && axes.leftRight && col % 2 === 1,
        bookMatched && axes.topBottom && row % 2 === 1
      );
    }
  }
  if (lastX % stepX !== 0 || lastY % stepY !== 0) {
    const col = Math.floor(lastX / stepX);
    const row = Math.floor(lastY / stepY);
    blitTile(
      ctx,
      tile,
      lastX,
      lastY,
      bookMatched && axes.leftRight && col % 2 === 1,
      bookMatched && axes.topBottom && row % 2 === 1
    );
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

export interface TextureizeOptions {
  /** Effective RGB boost (1 = none). From series hint × matt/glossy mode. */
  glossMultiplier?: number;
  /** Tile scale (<1 = finer grain for textured series). */
  textureScale?: number;
  /** Extra luminance contrast for grain feel (0–0.2 typical). */
  grainEmphasis?: number;
}

/** Apply a texture sheet (URL image) inside the mask — fast GPU compositing. */
export function textureizeMask(
  mask: CanvasImageSource,
  texture: HTMLImageElement,
  width: number,
  height: number,
  glossy: boolean,
  luminanceSource?: CanvasImageSource,
  textureUrl?: string,
  options?: TextureizeOptions
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d")!;

  const textureScale = options?.textureScale ?? 1;
  const grainEmphasis = options?.grainEmphasis ?? 0;
  const glossMultiplier =
    options?.glossMultiplier ?? (glossy ? 1.06 : 1);

  drawTiledTexture(
    ctx,
    texture,
    width,
    height,
    textureUrl ?? texture.src,
    textureScale
  );

  if (luminanceSource) {
    const basePx = readImageData(luminanceSource, width, height);
    const texPx = ctx.getImageData(0, 0, width, height);
    const lumLo = 0.78 - grainEmphasis * 0.35;
    const lumSpan = 0.22 + grainEmphasis * 0.55;
    for (let i = 0; i < texPx.data.length; i += 4) {
      const baseLum =
        (0.299 * basePx.data[i] + 0.587 * basePx.data[i + 1] + 0.114 * basePx.data[i + 2]) /
        255;
      const factor = lumLo + lumSpan * baseLum;
      texPx.data[i] = Math.min(255, Math.round(texPx.data[i] * factor));
      texPx.data[i + 1] = Math.min(255, Math.round(texPx.data[i + 1] * factor));
      texPx.data[i + 2] = Math.min(255, Math.round(texPx.data[i + 2] * factor));
    }
    ctx.putImageData(texPx, 0, 0);
  }

  const clip = buildClipAlpha(mask, width, height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(clip, 0, 0);

  if (glossMultiplier !== 1) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.min(255, d[i] * glossMultiplier);
      d[i + 1] = Math.min(255, d[i + 1] * glossMultiplier);
      d[i + 2] = Math.min(255, d[i + 2] * glossMultiplier);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return off;
}
