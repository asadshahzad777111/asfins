import {
  detectAlphaPolarity,
  isMaskPixelInside,
  layerHasAlphaVariation,
  type AlphaPolarity,
} from "@/lib/images/mask-alpha";

export interface RegionBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ParsedRegion {
  id: number;
  pixelCount: number;
  bounds: RegionBounds;
  centroid: { x: number; y: number };
}

export interface ParsedCutout {
  width: number;
  height: number;
  polarity: AlphaPolarity;
  regions: ParsedRegion[];
  /** Per-pixel region id (-1 = not a colour zone). */
  regionMap: Int32Array;
}

const REGION_COLORS = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#42d4f4",
  "#f032e6",
  "#bfef45",
  "#fabed4",
  "#469990",
  "#dcbeff",
  "#9a6324",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#a9a9a9",
];

export function getRegionColor(regionId: number): string {
  return REGION_COLORS[regionId % REGION_COLORS.length];
}

function isZonePixel(a: number, polarity: AlphaPolarity): boolean {
  return isMaskPixelInside(a, polarity);
}

/**
 * Flood-fill connected components of colour-zone pixels (transparent holes in cutout).
 * Region ids are assigned in top-to-bottom, left-to-right discovery order.
 */
export function parseTransparentRegions(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): ParsedCutout {
  const total = width * height;
  const polarity = detectAlphaPolarity(rgba, total);
  const hasAlpha = layerHasAlphaVariation(rgba, total);

  const regionMap = new Int32Array(total).fill(-1);
  const regions: ParsedRegion[] = [];
  const visited = new Uint8Array(total);
  let nextId = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;

      const pi = idx * 4;
      const a = rgba[pi + 3];
      const inside = hasAlpha ? isZonePixel(a, polarity) : false;
      if (!inside) continue;

      const id = nextId++;
      let pixelCount = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;

      const stack: number[] = [idx];
      visited[idx] = 1;

      while (stack.length > 0) {
        const cur = stack.pop()!;
        regionMap[cur] = id;
        pixelCount++;

        const cx = cur % width;
        const cy = (cur / width) | 0;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          cur - 1,
          cur + 1,
          cur - width,
          cur + width,
        ];
        for (const n of neighbors) {
          if (n < 0 || n >= total) continue;
          const nx = n % width;
          const ny = (n / width) | 0;
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          if (visited[n]) continue;

          const ni = n * 4;
          const na = rgba[ni + 3];
          if (!isZonePixel(na, polarity)) continue;

          visited[n] = 1;
          stack.push(n);
        }
      }

      regions.push({
        id,
        pixelCount,
        bounds: { minX, minY, maxX, maxY },
        centroid: {
          x: Math.round(sumX / pixelCount),
          y: Math.round(sumY / pixelCount),
        },
      });
    }
  }

  return { width, height, polarity, regions, regionMap };
}

export function regionAtPoint(
  regionMap: Int32Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return -1;
  return regionMap[iy * width + ix];
}

/** Build RGBA mask buffer: opaque white inside assigned regions, transparent elsewhere. */
export function buildZoneMaskPixels(
  width: number,
  height: number,
  regionMap: Int32Array,
  assignedRegionIds: number[]
): Uint8ClampedArray {
  const assigned = new Set(assignedRegionIds);
  const out = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    if (assigned.has(regionMap[i])) {
      out[pi] = 255;
      out[pi + 1] = 255;
      out[pi + 2] = 255;
      out[pi + 3] = 255;
    }
  }

  return out;
}

export function getUnmappedRegionIds(
  regions: ParsedRegion[],
  assignments: Record<string, number[]>
): number[] {
  const mapped = new Set<number>();
  for (const ids of Object.values(assignments)) {
    for (const id of ids) mapped.add(id);
  }
  return regions.filter((r) => !mapped.has(r.id)).map((r) => r.id);
}

export async function loadImageDataFromUrl(url: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        data: imageData.data,
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}

export async function loadImageDataFromFile(file: File): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImageDataFromUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
