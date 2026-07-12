import type { SceneConfig, SceneZoneConfig } from "@/lib/scenes/types";
import { defaultColorForPalette } from "@/lib/scenes/zones";
import {
  detectAlphaPolarity,
  isMaskPixelInside,
  layerHasAlphaVariation,
  type AlphaPolarity,
} from "@/lib/images/mask-alpha";
import { canvasSafeTextureUrl } from "@/lib/images/canvas-safe-url";
import { textureizeMask } from "@/lib/canvas/texture-mask";
import {
  buildCabinetUnionMask,
  clipBoardToCabinetMask,
  getCabinetMultiColourZones,
  paintColourBoard,
  type ColourBlock,
} from "@/lib/canvas/colour-board";
import {
  isActiveSplit,
  paintZoneSplit,
  type ZoneBoundingBox,
  type ZoneSplits,
  type ZoneSplitState,
} from "@/lib/canvas/colour-split";
import {
  effectiveGlossMultiplier,
  effectiveHighlightAlpha,
  type SeriesFinishHint,
} from "@/lib/catalogs/finish-hint";

export type FinishMode = "matt" | "glossy";
export type LightingMode = "day" | "night";

export type ZoneColors = Record<string, string>;
export type ZoneTextures = Record<string, string | undefined>;
export type ZoneFinishHints = Record<string, SeriesFinishHint | undefined>;

export type { ColourBlock };
export type { ZoneBoundingBox, ZoneSplits, ZoneSplitState };

export interface RenderState {
  zoneColors: ZoneColors;
  zoneTextures: ZoneTextures;
  finish: FinishMode;
  lighting: LightingMode;
  /** Multi-colour back board for cabinets only; empty = use per-zone colours. Advanced/free-form mode. */
  cabinetColourBoard: ColourBlock[];
  /** Per-zone line-split multi-colour state (default/simple mode). Zones without an active split use zoneColors. */
  zoneSplits: ZoneSplits;
  /** Per-zone series finish hint (gloss/texture feel) from catalog pick. */
  zoneFinishHints: ZoneFinishHints;
}

export type PartialZoneColors = Partial<ZoneColors>;

export type ConfiguratorUpdate = {
  zoneColors?: PartialZoneColors;
  zoneTextures?: Partial<ZoneTextures>;
  finish?: FinishMode;
  lighting?: LightingMode;
  cabinetColourBoard?: ColourBlock[];
  zoneSplits?: Partial<ZoneSplits>;
  zoneFinishHints?: Partial<ZoneFinishHints>;
};

export interface LoadedAssets {
  base: HTMLImageElement;
  /** Photo with transparent cabinet holes — colours show only through these. */
  cutout: HTMLImageElement | null;
  cutoutHoleData: ImageData | null;
  masks: Record<string, HTMLImageElement>;
  highlight: HTMLImageElement;
  nightGlow: HTMLImageElement;
}

export function defaultZoneColors(zones: SceneZoneConfig[]): ZoneColors {
  const colors: ZoneColors = {};
  for (const z of zones) {
    colors[z.id] = defaultColorForPalette(z.palette);
  }
  return colors;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const safeSrc = canvasSafeTextureUrl(src);
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required for getImageData / createPattern on remote textures.
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = safeSrc;
  });
}

export { loadImage as loadSceneImage };

const CUTOUT_HOLE_ALPHA = 128;

async function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

async function resolveCutoutImage(basePhoto: string): Promise<HTMLImageElement | null> {
  const dir = basePhoto.replace(/\/[^/]+$/, "");
  for (const name of ["cutout.png", "master-cutout.png"]) {
    const img = await tryLoadImage(`${dir}/${name}`);
    if (img) return img;
  }
  return null;
}

function readCutoutHoleData(
  cutout: HTMLImageElement,
  width: number,
  height: number
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(cutout, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** Keep colour pixels only where the cutout has a transparent hole. */
function clipLayerToCutoutHoles(
  layer: HTMLCanvasElement,
  holeData: ImageData,
  width: number,
  height: number
): void {
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  const px = ctx.getImageData(0, 0, width, height);
  const holes = holeData.data;
  for (let i = 0; i < px.data.length; i += 4) {
    if (holes[i + 3] >= CUTOUT_HOLE_ALPHA) {
      px.data[i + 3] = 0;
    }
  }
  ctx.putImageData(px, 0, 0);
}

export async function loadSceneAssets(scene: SceneConfig): Promise<LoadedAssets> {
  const [base, highlight, nightGlow, cutout, ...maskImgs] = await Promise.all([
    loadImage(scene.basePhoto),
    loadImage(scene.highlightMap),
    loadImage(scene.nightGlow),
    resolveCutoutImage(scene.basePhoto),
    ...scene.zones.map((z) => loadImage(z.maskPath)),
  ]);

  const masks: Record<string, HTMLImageElement> = {};
  scene.zones.forEach((z, i) => {
    masks[z.id] = maskImgs[i];
  });

  const w = base.naturalWidth;
  const h = base.naturalHeight;
  const cutoutHoleData = cutout ? readCutoutHoleData(cutout, w, h) : null;

  if (process.env.NODE_ENV === "development") {
    logMaskStatsDev(scene, masks);
    if (cutout) {
      console.info(`[cutout:${scene.id}] transparent-hole compositing enabled`);
    }
  }

  return { base, cutout, cutoutHoleData, masks, highlight, nightGlow };
}

/** Dev-only: log mask coverage to catch full-image mask bugs early. */
function logMaskStatsDev(
  scene: SceneConfig,
  masks: Record<string, HTMLImageElement>
): void {
  for (const zone of scene.zones) {
    const img = masks[zone.id];
    if (!img?.complete || !img.naturalWidth) continue;

    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) continue;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let active = 0;
    const total = c.width * c.height;
    const { mode, polarity } = detectMaskModeAndPolarity(data);
    for (let i = 0; i < data.length; i += 4) {
      if (maskIsInside(data[i], data[i + 1], data[i + 2], data[i + 3], mode, polarity)) {
        active++;
      }
    }
    const pct = ((active / total) * 100).toFixed(1);
    const warn = active / total > 0.6 ? " ⚠ full-image mask?" : "";
    console.info(
      `[mask:${scene.id}/${zone.id}] ${pct}% active (${mode}/${polarity})${warn}`
    );
  }
}

/** Pixels below this are treated as outside the mask (no colour). */
const MASK_CUTOFF = 0.5;

type MaskMode = "alpha" | "luminance";

function detectMaskModeAndPolarity(
  data: Uint8ClampedArray
): { mode: MaskMode; polarity: AlphaPolarity } {
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
  if (mode === "alpha") {
    return isMaskPixelInside(a, polarity);
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum >= MASK_CUTOFF;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized.padStart(6, "0").slice(0, 6);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function readImageData(source: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function colorizeMask(
  mask: CanvasImageSource,
  color: string,
  width: number,
  height: number,
  glossy: boolean,
  luminanceSource?: CanvasImageSource,
  glossMultiplier?: number
): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d")!;

  const maskPx = readImageData(mask, width, height);
  const { mode, polarity } = detectMaskModeAndPolarity(maskPx.data);
  const basePx = luminanceSource ? readImageData(luminanceSource, width, height) : null;
  const colorRgb = parseHexColor(color);
  const outPx = ctx.createImageData(width, height);

  for (let i = 0; i < maskPx.data.length; i += 4) {
    const r = maskPx.data[i];
    const g = maskPx.data[i + 1];
    const b = maskPx.data[i + 2];
    const maskAlpha = maskPx.data[i + 3];

    if (!maskIsInside(r, g, b, maskAlpha, mode, polarity)) continue;

    // Full catalogue swatch on masked pixels; light shading only (not original hue).
    let lumFactor = 1;
    if (basePx) {
      const baseLum =
        (0.299 * basePx.data[i] + 0.587 * basePx.data[i + 1] + 0.114 * basePx.data[i + 2]) /
        255;
      lumFactor = 0.82 + 0.18 * baseLum;
    }

    outPx.data[i] = Math.min(255, Math.round(colorRgb.r * lumFactor));
    outPx.data[i + 1] = Math.min(255, Math.round(colorRgb.g * lumFactor));
    outPx.data[i + 2] = Math.min(255, Math.round(colorRgb.b * lumFactor));
    outPx.data[i + 3] = 255;
  }
  ctx.putImageData(outPx, 0, 0);

  const mult = glossMultiplier ?? (glossy ? 1.08 : 1);
  if (mult !== 1) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.min(255, d[i] * mult);
      d[i + 1] = Math.min(255, d[i + 1] * mult);
      d[i + 2] = Math.min(255, d[i + 2] * mult);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return off;
}

export class SceneRenderer {
  private scene: SceneConfig;
  private assets: LoadedAssets | null = null;
  private zoneCache = new Map<string, HTMLCanvasElement>();
  private textureCache = new Map<string, HTMLImageElement>();
  /** Zone pixel bounding box — static per scene, computed once and cached. */
  private zoneBoxCache = new Map<string, ZoneBoundingBox>();
  /** Binary alpha clip mask per zone — static per scene; avoids re-binarizing on every
   *  split-divider drag frame (that per-pixel scan would otherwise run every frame). */
  private zoneClipCache = new Map<string, HTMLCanvasElement>();
  private renderScheduled = false;
  /** Guards against out-of-order async completion overwriting a newer render with a stale one. */
  private renderGeneration = 0;
  private mainCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: RenderState;

  constructor(scene: SceneConfig, canvas: HTMLCanvasElement, initialState: RenderState) {
    this.scene = scene;
    this.mainCanvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.state = initialState;
    canvas.width = scene.width;
    canvas.height = scene.height;
  }

  async init(): Promise<void> {
    this.assets = await loadSceneAssets(this.scene);
    const w = this.assets.base.naturalWidth;
    const h = this.assets.base.naturalHeight;
    this.mainCanvas.width = w;
    this.mainCanvas.height = h;
    (this.scene as { width: number; height: number }).width = w;
    (this.scene as { height: number }).height = h;
    await this.fullRenderAsync();
  }

  setState(partial: ConfiguratorUpdate): void {
    const prev = {
      ...this.state,
      zoneColors: { ...this.state.zoneColors },
      zoneTextures: { ...this.state.zoneTextures },
      cabinetColourBoard: [...this.state.cabinetColourBoard],
      zoneSplits: { ...this.state.zoneSplits },
      zoneFinishHints: { ...this.state.zoneFinishHints },
    };
    const mergedZoneColors = partial.zoneColors
      ? { ...this.state.zoneColors }
      : this.state.zoneColors;
    if (partial.zoneColors) {
      for (const [key, val] of Object.entries(partial.zoneColors)) {
        if (val !== undefined) mergedZoneColors[key] = val;
      }
    }
    const mergedZoneTextures = partial.zoneTextures
      ? { ...this.state.zoneTextures }
      : this.state.zoneTextures;
    if (partial.zoneTextures) {
      for (const [key, val] of Object.entries(partial.zoneTextures)) {
        mergedZoneTextures[key] = val;
      }
    }
    const mergedZoneSplits = partial.zoneSplits
      ? { ...this.state.zoneSplits }
      : this.state.zoneSplits;
    if (partial.zoneSplits) {
      for (const [key, val] of Object.entries(partial.zoneSplits)) {
        if (val === undefined) delete mergedZoneSplits[key];
        else mergedZoneSplits[key] = val;
      }
    }
    const mergedFinishHints = partial.zoneFinishHints
      ? { ...this.state.zoneFinishHints }
      : this.state.zoneFinishHints;
    if (partial.zoneFinishHints) {
      for (const [key, val] of Object.entries(partial.zoneFinishHints)) {
        mergedFinishHints[key] = val;
      }
    }
    this.state = {
      ...this.state,
      ...partial,
      zoneColors: mergedZoneColors,
      zoneTextures: mergedZoneTextures,
      zoneSplits: mergedZoneSplits,
      zoneFinishHints: mergedFinishHints,
      cabinetColourBoard:
        partial.cabinetColourBoard !== undefined
          ? partial.cabinetColourBoard
          : this.state.cabinetColourBoard,
    };

    if (partial.cabinetColourBoard !== undefined) {
      this.zoneCache.clear();
      this.scheduleRender();
      return;
    }

    if (partial.zoneSplits !== undefined) {
      this.scheduleRender();
      return;
    }

    if (partial.zoneColors || partial.zoneTextures || partial.zoneFinishHints) {
      const changedZones = new Set([
        ...(partial.zoneColors ? Object.keys(partial.zoneColors) : []),
        ...(partial.zoneTextures ? Object.keys(partial.zoneTextures) : []),
        ...(partial.zoneFinishHints ? Object.keys(partial.zoneFinishHints) : []),
      ]);
      if (changedZones.size > 0 && this.assets) {
        for (const z of changedZones) {
          this.zoneCache.delete(this.cacheKey(z, this.state.finish));
        }
        this.scheduleRender();
        return;
      }
    }

    if (partial.finish && partial.finish !== prev.finish) {
      this.zoneCache.clear();
    }

    this.scheduleRender();
  }

  async preloadTexture(url: string): Promise<HTMLImageElement> {
    if (this.textureCache.has(url)) return this.textureCache.get(url)!;
    const img = await loadImage(url);
    this.textureCache.set(url, img);
    return img;
  }

  /** Pixel bounding box of a zone's mask, in scene pixel space. Used to position split dividers. */
  getZoneBoundingBox(zoneId: string): ZoneBoundingBox | null {
    if (!this.assets) return null;
    const cached = this.zoneBoxCache.get(zoneId);
    if (cached) return cached;

    const mask = this.assets.masks[zoneId];
    if (!mask) return null;
    const { width, height } = this.scene;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(mask, 0, 0, width, height);
    const px = ctx.getImageData(0, 0, width, height);
    const { mode, polarity } = detectMaskModeAndPolarity(px.data);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      const rowBase = y * width;
      for (let x = 0; x < width; x++) {
        const i = (rowBase + x) * 4;
        if (
          maskIsInside(px.data[i], px.data[i + 1], px.data[i + 2], px.data[i + 3], mode, polarity)
        ) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const box: ZoneBoundingBox =
      maxX < 0
        ? { x: 0, y: 0, w: width, h: height }
        : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    this.zoneBoxCache.set(zoneId, box);
    return box;
  }

  private getZoneClipMask(zoneId: string): HTMLCanvasElement | null {
    if (!this.assets) return null;
    const cached = this.zoneClipCache.get(zoneId);
    if (cached) return cached;

    const mask = this.assets.masks[zoneId];
    if (!mask) return null;
    const { width, height } = this.scene;
    const union = buildCabinetUnionMask(this.assets.masks, [zoneId], width, height);
    // buildCabinetUnionMask is generic (any zone ids) — reuse it to get a clean
    // binary-ish canvas, then bake it once via the same binarizing step used for
    // the free-form board so per-frame clipping is a cheap drawImage, not a scan.
    const clip = clipBoardToCabinetMask(union, union, width, height);
    this.zoneClipCache.set(zoneId, clip);
    return clip;
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      void this.fullRenderAsync();
    });
  }

  getState(): RenderState {
    return this.state;
  }

  private cacheKey(zone: string, finish: FinishMode): string {
    const tex = this.state.zoneTextures[zone] ?? "";
    const hintId = this.state.zoneFinishHints[zone]?.id ?? "";
    return `${zone}-${this.state.zoneColors[zone]}-${tex}-${finish}-${hintId}`;
  }

  private async getZoneCanvas(zoneId: string): Promise<HTMLCanvasElement | null> {
    if (!this.assets) return null;
    const key = this.cacheKey(zoneId, this.state.finish);
    if (this.zoneCache.has(key)) return this.zoneCache.get(key)!;

    const mask = this.assets.masks[zoneId];
    if (!mask) return null;
    const color = this.state.zoneColors[zoneId];
    const textureUrl = this.state.zoneTextures[zoneId];
    const glossy = this.state.finish === "glossy";
    const zoneCfg = this.scene.zones.find((z) => z.id === zoneId);
    const zoneAllowsGloss = zoneCfg?.glossyHighlight ?? false;
    const useGlossy = glossy && zoneAllowsGloss;
    const hint = this.state.zoneFinishHints[zoneId];
    const glossMult = effectiveGlossMultiplier(
      this.state.finish,
      hint,
      zoneAllowsGloss
    );

    let colored: HTMLCanvasElement;
    if (textureUrl) {
      try {
        const texture = await this.preloadTexture(textureUrl);
        colored = textureizeMask(
          mask,
          texture,
          this.scene.width,
          this.scene.height,
          useGlossy,
          this.assets.base,
          textureUrl,
          {
            glossMultiplier: glossMult,
            textureScale: hint?.textureScale ?? 1,
            grainEmphasis: hint?.grainEmphasis ?? 0,
          }
        );
      } catch {
        colored = colorizeMask(
          mask,
          color,
          this.scene.width,
          this.scene.height,
          useGlossy,
          this.assets.base,
          glossMult
        );
      }
    } else {
      colored = colorizeMask(
        mask,
        color,
        this.scene.width,
        this.scene.height,
        useGlossy,
        this.assets.base,
        glossMult
      );
    }
    this.zoneCache.set(key, colored);
    if (this.assets.cutoutHoleData) {
      clipLayerToCutoutHoles(
        colored,
        this.assets.cutoutHoleData,
        this.scene.width,
        this.scene.height
      );
    }
    return colored;
  }

  /** Line-split multi-colour zone render — segments intersected with this zone's own mask only. */
  private async getZoneSplitCanvas(
    zoneId: string,
    split: ZoneSplitState
  ): Promise<HTMLCanvasElement | null> {
    if (!this.assets) return null;
    const box = this.getZoneBoundingBox(zoneId);
    const clip = this.getZoneClipMask(zoneId);
    if (!box || !clip) return null;
    const { width, height } = this.scene;

    const painted = await paintZoneSplit(split, box, width, height, (url) =>
      this.preloadTexture(url)
    );
    const pctx = painted.getContext("2d")!;
    pctx.globalCompositeOperation = "destination-in";
    pctx.drawImage(clip, 0, 0);
    pctx.globalCompositeOperation = "source-over";

    if (this.assets.cutoutHoleData) {
      clipLayerToCutoutHoles(painted, this.assets.cutoutHoleData, width, height);
    }
    return painted;
  }

  async fullRenderAsync(): Promise<void> {
    if (!this.assets) return;
    // Snapshot a generation token: if a newer render starts (and finishes) while
    // this one is still awaiting texture loads, this stale render must not paint
    // over the newer result — otherwise the canvas can visibly "revert" to an
    // older colour (or the plain base photo) after the user already applied a change.
    const gen = ++this.renderGeneration;
    const { width, height } = this.scene;
    const sorted = [...this.scene.zones].sort((a, b) => a.zIndex - b.zIndex);
    const cabinetZones = getCabinetMultiColourZones(this.scene.zones);
    const cabinetIds = new Set(cabinetZones.map((z) => z.id));
    const useBoard = this.state.cabinetColourBoard.length > 0 && cabinetIds.size > 0;

    const colorLayer = document.createElement("canvas");
    colorLayer.width = width;
    colorLayer.height = height;
    const colorCtx = colorLayer.getContext("2d")!;

    for (const zone of sorted) {
      // When multi-colour board is active, skip per-zone cabinet fills —
      // the board composite replaces them.
      if (useBoard && cabinetIds.has(zone.id)) continue;

      const split = this.state.zoneSplits[zone.id];
      if (isActiveSplit(split)) {
        const layer = await this.getZoneSplitCanvas(zone.id, split!);
        if (layer) colorCtx.drawImage(layer, 0, 0);
        continue;
      }

      const layer = await this.getZoneCanvas(zone.id);
      if (layer) colorCtx.drawImage(layer, 0, 0);
    }

    if (useBoard) {
      const board = await paintColourBoard(
        this.state.cabinetColourBoard,
        width,
        height,
        (url) => this.preloadTexture(url)
      );
      const union = buildCabinetUnionMask(
        this.assets.masks,
        [...cabinetIds],
        width,
        height
      );
      const clipped = clipBoardToCabinetMask(board, union, width, height);
      if (this.assets.cutoutHoleData) {
        clipLayerToCutoutHoles(
          clipped,
          this.assets.cutoutHoleData,
          width,
          height
        );
      }
      colorCtx.drawImage(clipped, 0, 0);
    }

    // Abort if a newer render has since started — never paint stale content
    // over a more recent (correct) frame.
    if (gen !== this.renderGeneration) return;

    this.ctx.clearRect(0, 0, width, height);

    if (this.assets.cutout) {
      this.ctx.drawImage(colorLayer, 0, 0);
      this.ctx.drawImage(this.assets.cutout, 0, 0, width, height);
    } else {
      this.ctx.drawImage(this.assets.base, 0, 0, width, height);
      this.ctx.drawImage(colorLayer, 0, 0);
    }

    if (this.state.finish === "glossy") {
      this.applyGlossyHighlight();
    }

    this.applyLighting();
  }

  fullRender(): void {
    void this.fullRenderAsync();
  }

  private applyGlossyHighlight(): void {
    if (!this.assets) return;
    const { width, height } = this.scene;
    const hints = Object.values(this.state.zoneFinishHints).filter(Boolean) as SeriesFinishHint[];
    const alpha =
      hints.length > 0
        ? Math.max(...hints.map((h) => effectiveHighlightAlpha("glossy", h)))
        : 0.35;
    if (alpha <= 0) return;
    this.ctx.save();
    this.ctx.globalCompositeOperation = "screen";
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.assets.highlight, 0, 0, width, height);
    this.ctx.restore();
  }

  private applyLighting(): void {
    if (!this.assets) return;
    const { width, height } = this.scene;

    if (this.state.lighting === "night") {
      this.ctx.save();
      this.ctx.globalCompositeOperation = "multiply";
      this.ctx.fillStyle = "rgba(45, 35, 28, 0.45)";
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();

      this.ctx.save();
      this.ctx.globalCompositeOperation = "screen";
      this.ctx.globalAlpha = 0.55;
      this.ctx.drawImage(this.assets.nightGlow, 0, 0, width, height);
      this.ctx.restore();
    }
  }

  exportPng(): string {
    return this.mainCanvas.toDataURL("image/png");
  }
}

export const DEFAULT_ZONE_COLORS: ZoneColors = {
  cabinets: "#3D4555",
  island: "#3D4555",
  shelves: "#8B6914",
  wall: "#F5F0E8",
  floor: "#C4A574",
};
