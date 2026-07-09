import {
  detectAlphaPolarity,
  isMaskPixelInside,
  layerHasAlphaVariation,
  type AlphaPolarity,
} from "@/lib/images/mask-alpha";

const MASK_CUTOFF = 0.5;
type MaskMode = "alpha" | "luminance";

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

/** Tile size so texture repeats naturally without harsh pixel stretch. */
export function computeTextureTileSize(
  textureW: number,
  textureH: number,
  canvasW: number,
  canvasH: number
): { tileW: number; tileH: number } {
  const shortSide = Math.min(canvasW, canvasH);
  const longSide = Math.max(canvasW, canvasH);
  const targetTile = Math.max(96, Math.min(shortSide / 3, longSide / 8));
  const nativeMax = Math.max(textureW, textureH, 1);
  let scale = targetTile / nativeMax;
  scale = Math.min(scale, 1.5);
  scale = Math.max(scale, targetTile / nativeMax);
  return {
    tileW: Math.max(48, textureW * scale),
    tileH: Math.max(48, textureH * scale),
  };
}

function drawTiledTexture(
  ctx: CanvasRenderingContext2D,
  texture: HTMLImageElement,
  width: number,
  height: number
): void {
  const { tileW, tileH } = computeTextureTileSize(
    texture.naturalWidth,
    texture.naturalHeight,
    width,
    height
  );
  for (let y = 0; y < height; y += tileH) {
    for (let x = 0; x < width; x += tileW) {
      ctx.drawImage(texture, x, y, tileW, tileH);
    }
  }
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
  luminanceSource?: CanvasImageSource
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d")!;

  drawTiledTexture(ctx, texture, width, height);

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
