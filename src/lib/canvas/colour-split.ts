import { textureizeMask } from "@/lib/canvas/texture-mask";

/**
 * Generic line-split multi-colour mode — works for any zone (cabinets, floor,
 * wall, tile, etc). A zone's bounding box is divided into 2-4 segments by
 * draggable divider line(s); each segment is independently colourable.
 * This is the default / simple multi-colour mode. See colour-board.ts for the
 * free-form "Advanced" block board kept for power users.
 */

export type SplitOrientation = "vertical" | "horizontal";

export interface SplitSegment {
  id: string;
  hex: string;
  imageUrl?: string;
}

export interface ZoneSplitState {
  /** "vertical" = a vertical line moving left-right, splitting into left/right segments.
   *  "horizontal" = a horizontal line moving up-down, splitting into top/bottom segments. */
  orientation: SplitOrientation;
  /** Divider positions as 0..1 fractions along the split axis, ascending, length = segments.length - 1. */
  dividers: number[];
  segments: SplitSegment[];
}

export type ZoneSplits = Record<string, ZoneSplitState>;

export interface ZoneBoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_SPLIT_SEGMENTS = 4;
/** Minimum segment size as a fraction of the zone's split axis — stops segments inverting/crossing. */
export const MIN_SEGMENT_FRACTION = 0.1;

let uidCounter = 0;
function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

export function createSplitSegment(hex: string, imageUrl?: string): SplitSegment {
  return { id: uid("seg"), hex, imageUrl };
}

export function createInitialSplit(hex: string, imageUrl?: string): ZoneSplitState {
  return {
    orientation: "vertical",
    dividers: [],
    segments: [createSplitSegment(hex, imageUrl)],
  };
}

function evenDividers(count: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < count; i++) out.push(i / count);
  return out;
}

/** Auto-detect the natural split direction from the zone's aspect ratio. */
export function autoOrientation(box: ZoneBoundingBox): SplitOrientation {
  return box.w >= box.h ? "vertical" : "horizontal";
}

export function addSplitSegment(state: ZoneSplitState, hex: string, imageUrl?: string): ZoneSplitState {
  if (state.segments.length >= MAX_SPLIT_SEGMENTS) return state;
  const segments = [...state.segments, createSplitSegment(hex, imageUrl)];
  return { ...state, dividers: evenDividers(segments.length), segments };
}

export function removeSplitSegment(state: ZoneSplitState, index: number): ZoneSplitState {
  if (state.segments.length <= 1) return state;
  const segments = state.segments.filter((_, i) => i !== index);
  return { ...state, dividers: evenDividers(segments.length), segments };
}

export function setSplitOrientation(
  state: ZoneSplitState,
  orientation: SplitOrientation
): ZoneSplitState {
  if (orientation === state.orientation) return state;
  return { ...state, orientation };
}

export function updateSplitSegment(
  state: ZoneSplitState,
  id: string,
  patch: Partial<Pick<SplitSegment, "hex" | "imageUrl">>
): ZoneSplitState {
  return {
    ...state,
    segments: state.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
}

/** Move divider at `index`, clamped so neighbouring segments can never invert or cross. */
export function moveSplitDivider(
  state: ZoneSplitState,
  index: number,
  fraction: number
): ZoneSplitState {
  if (index < 0 || index >= state.dividers.length) return state;
  const dividers = [...state.dividers];
  const lo = index === 0 ? 0 : dividers[index - 1];
  const hi = index === dividers.length - 1 ? 1 : dividers[index + 1];
  const min = lo + MIN_SEGMENT_FRACTION;
  const max = hi - MIN_SEGMENT_FRACTION;
  const clamped = Math.min(Math.max(min, max), Math.max(min, Math.min(max, fraction)));
  dividers[index] = clamped;
  return { ...state, dividers };
}

/** Pixel rects for each segment within the zone bounding box, in scene pixel space. */
export function splitSegmentBounds(
  state: ZoneSplitState,
  box: ZoneBoundingBox
): ZoneBoundingBox[] {
  const cuts = [0, ...state.dividers, 1];
  return state.segments.map((_, i) => {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (state.orientation === "vertical") {
      const x = Math.round(box.x + a * box.w);
      const xEnd = Math.round(box.x + b * box.w);
      return { x, y: box.y, w: Math.max(1, xEnd - x), h: box.h };
    }
    const y = Math.round(box.y + a * box.h);
    const yEnd = Math.round(box.y + b * box.h);
    return { x: box.x, y, w: box.w, h: Math.max(1, yEnd - y) };
  });
}

/** Paint segment colours/textures onto a canvas the size of the scene (unclipped — caller clips to zone mask). */
export async function paintZoneSplit(
  state: ZoneSplitState,
  box: ZoneBoundingBox,
  width: number,
  height: number,
  loadTexture: (url: string) => Promise<HTMLImageElement>
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  const bounds = splitSegmentBounds(state, box);
  for (let i = 0; i < state.segments.length; i++) {
    const seg = state.segments[i];
    const rect = bounds[i];
    if (seg.imageUrl) {
      try {
        const img = await loadTexture(seg.imageUrl);
        const rectMask = document.createElement("canvas");
        rectMask.width = width;
        rectMask.height = height;
        const mctx = rectMask.getContext("2d")!;
        mctx.fillStyle = "#fff";
        mctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        const tiled = textureizeMask(rectMask, img, width, height, false, undefined, seg.imageUrl);
        ctx.drawImage(tiled, 0, 0);
        continue;
      } catch {
        // fall through to solid hex
      }
    }
    ctx.fillStyle = seg.hex || "#888888";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  return canvas;
}

/** True once a zone has a real (2+) segment split — a single-segment split is a no-op state. */
export function isActiveSplit(state: ZoneSplitState | undefined): boolean {
  return Boolean(state && state.segments.length > 1);
}
