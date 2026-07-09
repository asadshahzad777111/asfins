import {
  detectAlphaPolarity,
  isMaskPixelInside,
  layerHasAlphaVariation,
  type AlphaPolarity,
} from "@/lib/images/mask-alpha";
import type { SceneZoneConfig } from "@/lib/scenes/types";
import { getCabinetClickZones } from "@/lib/canvas/cabinet-zones";

const MASK_CUTOFF = 0.5;

type MaskMode = "alpha" | "luminance";

export interface MaskSnapshot {
  zoneId: string;
  label: string;
  zIndex: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  mode: MaskMode;
  polarity: AlphaPolarity;
  centroid: { x: number; y: number };
}

function detectMaskModeAndPolarity(
  data: Uint8ClampedArray
): { mode: MaskMode; polarity: AlphaPolarity } {
  const total = data.length / 4;
  if (layerHasAlphaVariation(data, total)) {
    return { mode: "alpha", polarity: detectAlphaPolarity(data, total) };
  }
  return { mode: "luminance", polarity: "opaque-zone" };
}

function pixelInside(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  mode: MaskMode,
  polarity: AlphaPolarity
): boolean {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= width) return false;
  const i = (yi * width + xi) * 4;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  if (mode === "alpha") return isMaskPixelInside(a, polarity);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum >= MASK_CUTOFF;
}

export function snapshotMask(
  img: HTMLImageElement,
  zone: SceneZoneConfig
): MaskSnapshot | null {
  if (!img.complete || !img.naturalWidth) return null;
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { mode, polarity } = detectMaskModeAndPolarity(imageData.data);

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixelInside(imageData.data, width, x, y, mode, polarity)) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (count === 0) return null;

  return {
    zoneId: zone.id,
    label: zone.label,
    zIndex: zone.zIndex,
    width,
    height,
    data: imageData.data,
    mode,
    polarity,
    centroid: { x: sumX / count, y: sumY / count },
  };
}

export function findCabinetZoneAt(
  snapshots: MaskSnapshot[],
  zones: SceneZoneConfig[],
  x: number,
  y: number
): string | null {
  const cabinetIds = new Set(getCabinetClickZones(zones).map((z) => z.id));
  const sorted = [...snapshots]
    .filter((s) => cabinetIds.has(s.zoneId))
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const snap of sorted) {
    if (pixelInside(snap.data, snap.width, x, y, snap.mode, snap.polarity)) {
      return snap.zoneId;
    }
  }
  return null;
}

function isEdgePixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  mode: MaskMode,
  polarity: AlphaPolarity
): boolean {
  if (!pixelInside(data, width, x, y, mode, polarity)) return false;
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];
  return neighbors.some(
    ([nx, ny]) => !pixelInside(data, width, nx, ny, mode, polarity)
  );
}

export interface DrawOverlayOptions {
  activeZoneId: string | null;
  hoverZoneId: string | null;
  showLines: boolean;
  dashOffset?: number;
}

/** Asphalt-style glowing zone outlines + hover fill. */
export function drawCabinetZoneOverlay(
  ctx: CanvasRenderingContext2D,
  snapshots: MaskSnapshot[],
  options: DrawOverlayOptions
): void {
  const { activeZoneId, hoverZoneId, showLines, dashOffset = 0 } = options;
  const cabinetSnaps = snapshots;

  for (const snap of cabinetSnaps) {
    const isActive = snap.zoneId === activeZoneId;
    const isHover = snap.zoneId === hoverZoneId;
    if (!showLines && !isActive && !isHover) continue;

    const { width, height, data, mode, polarity } = snap;

    if (isHover && !isActive) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#b8893a";
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (pixelInside(data, width, x, y, mode, polarity)) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.restore();
    }

    if (!showLines && !isActive) continue;

    const edgeCanvas = document.createElement("canvas");
    edgeCanvas.width = width;
    edgeCanvas.height = height;
    const edgeCtx = edgeCanvas.getContext("2d")!;
    const edgeImg = edgeCtx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isEdgePixel(data, width, height, x, y, mode, polarity)) continue;
        const pi = (y * width + x) * 4;
        edgeImg.data[pi] = 184;
        edgeImg.data[pi + 1] = 137;
        edgeImg.data[pi + 2] = 58;
        edgeImg.data[pi + 3] = isActive ? 255 : isHover ? 220 : 160;
      }
    }
    edgeCtx.putImageData(edgeImg, 0, 0);

    ctx.save();
    ctx.shadowColor = isActive ? "rgba(184, 137, 58, 0.95)" : "rgba(184, 137, 58, 0.55)";
    ctx.shadowBlur = isActive ? 10 : 6;
    ctx.globalAlpha = isActive ? 1 : isHover ? 0.9 : 0.65;
    ctx.drawImage(edgeCanvas, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.beginPath();
    let started = false;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (!isEdgePixel(data, width, height, x, y, mode, polarity)) continue;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    if (started) ctx.stroke();
    ctx.restore();

    if (showLines || isActive) {
      const shortLabel =
        snap.label.length > 14 ? snap.label.split(" ")[0] : snap.label;
      ctx.save();
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tx = snap.centroid.x;
      const ty = snap.centroid.y;
      const metrics = ctx.measureText(shortLabel);
      const pad = 6;
      ctx.fillStyle = isActive ? "rgba(184, 137, 58, 0.92)" : "rgba(28, 20, 16, 0.75)";
      ctx.fillRect(
        tx - metrics.width / 2 - pad,
        ty - 8,
        metrics.width + pad * 2,
        16
      );
      ctx.fillStyle = "#fff";
      ctx.fillText(shortLabel, tx, ty);
      ctx.restore();
    }
  }
}
