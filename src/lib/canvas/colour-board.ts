import type { SceneZoneConfig } from "@/lib/scenes/types";
import { inferZoneGroup } from "@/lib/scenes/zones";
import { textureizeMask } from "@/lib/canvas/texture-mask";

/** A catalog colour/texture block on the multi-colour back board. */
export type ColourBlock = {
  id: string;
  hex: string;
  imageUrl?: string;
  /** Scene pixel space */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Higher = in front */
  z: number;
};

/**
 * Cabinets only — exclude floor / curtains / ceiling / countertop / backsplash / table.
 * Matches upper-*, lower-*, island, cabinets.
 */
export function isCabinetMultiColourZone(zone: SceneZoneConfig): boolean {
  const id = zone.id.toLowerCase();
  if (/floor|curtain|ceiling|wall|countertop|backsplash|table|shelf/.test(id)) {
    return false;
  }
  if (/cabinet|upper-|lower-|island|^cabinets$/.test(id)) return true;
  return inferZoneGroup(zone) === "wood" && !/table|shelf/.test(id);
}

export function getCabinetMultiColourZones(zones: SceneZoneConfig[]): SceneZoneConfig[] {
  return zones.filter(isCabinetMultiColourZone);
}

export function sceneHasCabinetMultiColour(zones: SceneZoneConfig[]): boolean {
  return getCabinetMultiColourZones(zones).length > 0;
}

/** Paint colour blocks (by z) onto an offscreen canvas the size of the scene. */
export async function paintColourBoard(
  blocks: ColourBlock[],
  width: number,
  height: number,
  loadTexture: (url: string) => Promise<HTMLImageElement>
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  const sorted = [...blocks].sort((a, b) => a.z - b.z);
  for (const block of sorted) {
    const x = Math.round(block.x);
    const y = Math.round(block.y);
    const w = Math.max(1, Math.round(block.w));
    const h = Math.max(1, Math.round(block.h));

    if (block.imageUrl) {
      try {
        const img = await loadTexture(block.imageUrl);
        // Tile texture into the block rect via a temp mask (full rect)
        const mask = document.createElement("canvas");
        mask.width = width;
        mask.height = height;
        const mctx = mask.getContext("2d")!;
        mctx.fillStyle = "#fff";
        mctx.fillRect(x, y, w, h);
        const tiled = textureizeMask(mask, img, width, height, false, undefined, block.imageUrl);
        ctx.drawImage(tiled, 0, 0);
        continue;
      } catch {
        // fall through to solid hex
      }
    }
    ctx.fillStyle = block.hex || "#888888";
    ctx.fillRect(x, y, w, h);
  }

  return canvas;
}

/** OR together cabinet masks into one alpha mask canvas. */
export function buildCabinetUnionMask(
  masks: Record<string, HTMLImageElement>,
  zoneIds: string[],
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  for (const id of zoneIds) {
    const mask = masks[id];
    if (!mask) continue;
    ctx.drawImage(mask, 0, 0, width, height);
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

/**
 * Clip a painted colour board to the union of cabinet masks.
 * Returns a layer ready to draw over the scene colour stack.
 */
export function clipBoardToCabinetMask(
  board: HTMLCanvasElement,
  unionMask: HTMLCanvasElement,
  width: number,
  height: number
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(board, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  // Convert mask luminance/alpha to clip — draw white where mask is "inside"
  const clip = document.createElement("canvas");
  clip.width = width;
  clip.height = height;
  const cctx = clip.getContext("2d")!;
  cctx.drawImage(unionMask, 0, 0);
  const px = cctx.getImageData(0, 0, width, height);
  for (let i = 0; i < px.data.length; i += 4) {
    const a = px.data[i + 3];
    const lum = (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3;
    const inside = a > 128 || lum > 128;
    px.data[i] = 255;
    px.data[i + 1] = 255;
    px.data[i + 2] = 255;
    px.data[i + 3] = inside ? 255 : 0;
  }
  cctx.putImageData(px, 0, 0);
  ctx.drawImage(clip, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return out;
}
