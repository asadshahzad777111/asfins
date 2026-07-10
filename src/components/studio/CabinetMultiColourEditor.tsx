"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SwatchThumb } from "@/components/SwatchThumb";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { ColourBlock } from "@/lib/canvas/colour-board";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";

interface CabinetMultiColourEditorProps {
  sceneWidth: number;
  sceneHeight: number;
  basePhotoUrl: string;
  /** Candidate cutout PNG URLs (cutout.png / master-cutout.png) — first that loads wins. */
  cutoutUrls?: string[];
  /** Cabinet zone mask URLs — used to clip blocks + show hole guidance when no cutout. */
  clipMaskUrls?: string[];
  blocks: ColourBlock[];
  onChange: (blocks: ColourBlock[]) => void;
  catalogs: Catalog[];
  onDone: () => void;
  onClear: () => void;
}

type ResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

type DragMode =
  | { kind: "move"; id: string; ox: number; oy: number }
  | {
      kind: "resize";
      id: string;
      handle: ResizeHandle;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
      originX: number;
      originY: number;
    }
  | null;

const MIN_BLOCK = 40;
/** Touch-friendly handle size (matches ZoneSplitOverlay grab targets). */
const HANDLE_PX = 36;

function uid() {
  return `cb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Re-index z to 0..n-1 in current visual order so stacking stays predictable. */
function normalizeZ(blocks: ColourBlock[]): ColourBlock[] {
  const sorted = [...blocks].sort((a, b) => a.z - b.z);
  const zById = new Map(sorted.map((b, i) => [b.id, i]));
  return blocks.map((b) => ({ ...b, z: zById.get(b.id) ?? b.z }));
}

function clampBlock(
  x: number,
  y: number,
  w: number,
  h: number,
  sceneWidth: number,
  sceneHeight: number
) {
  const nw = Math.max(MIN_BLOCK, Math.min(w, sceneWidth));
  const nh = Math.max(MIN_BLOCK, Math.min(h, sceneHeight));
  const nx = Math.max(0, Math.min(x, sceneWidth - nw));
  const ny = Math.max(0, Math.min(y, sceneHeight - nh));
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Build a white-on-transparent CSS mask from cabinet zone masks (OR union).
 * Falls back to inverting a cutout PNG (transparent holes → opaque mask).
 */
async function buildClipMaskDataUrl(
  width: number,
  height: number,
  maskUrls: string[],
  cutoutUrl: string | null
): Promise<string | null> {
  // Cap mask resolution for CSS — full 6k scenes would OOM on small machines.
  const maxEdge = 1200;
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const load = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  ctx.clearRect(0, 0, w, h);

  if (maskUrls.length > 0) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    let any = false;
    for (const url of maskUrls) {
      const img = await load(url);
      if (!img) continue;
      any = true;
      ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.globalCompositeOperation = "source-over";
    if (!any) return null;
    const px = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < px.data.length; i += 4) {
      const a = px.data[i + 3];
      const lum = (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3;
      const inside = a > 128 || lum > 128;
      px.data[i] = px.data[i + 1] = px.data[i + 2] = 255;
      px.data[i + 3] = inside ? 255 : 0;
    }
    ctx.putImageData(px, 0, 0);
    return canvas.toDataURL("image/png");
  }

  if (cutoutUrl) {
    const cutout = await load(cutoutUrl);
    if (!cutout) return null;
    ctx.drawImage(cutout, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < px.data.length; i += 4) {
      const hole = px.data[i + 3] < 128;
      px.data[i] = px.data[i + 1] = px.data[i + 2] = 255;
      px.data[i + 3] = hole ? 255 : 0;
    }
    ctx.putImageData(px, 0, 0);
    return canvas.toDataURL("image/png");
  }

  return null;
}

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};

export function CabinetMultiColourEditor({
  sceneWidth,
  sceneHeight,
  basePhotoUrl,
  cutoutUrls = [],
  clipMaskUrls = [],
  blocks,
  onChange,
  catalogs,
  onDone,
  onClear,
}: CabinetMultiColourEditorProps) {
  const { t } = useLanguage();
  const boardRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const [clipMaskUrl, setClipMaskUrl] = useState<string | null>(null);
  const [activeCutoutUrl, setActiveCutoutUrl] = useState<string | null>(null);
  const [catalogId, setCatalogId] = useState(
    () => catalogs.find((c) => c.id === "zrk-group")?.id ?? catalogs[0]?.id ?? ""
  );

  const woodCatalogs = useMemo(
    () => catalogs.filter((c) => c.swatches.some((s) => s.palette === "wood")),
    [catalogs]
  );
  const activeCatalog = woodCatalogs.find((c) => c.id === catalogId) ?? woodCatalogs[0];
  const swatches = (activeCatalog?.swatches ?? []).filter((s) => s.palette === "wood");

  const scale = useMemo(() => {
    const maxW = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.9 : 900, 900);
    return maxW / Math.max(sceneWidth, 1);
  }, [sceneWidth]);

  const displayW = sceneWidth * scale;
  const displayH = sceneHeight * scale;

  // Resolve which cutout PNG exists (external image probe → effect is correct).
  const cutoutKey = cutoutUrls.join("|");
  useEffect(() => {
    let cancelled = false;
    const urls = cutoutKey ? cutoutKey.split("|") : [];
    void (async () => {
      for (const src of urls) {
        const ok = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = src;
        });
        if (ok && !cancelled) {
          setActiveCutoutUrl(src);
          return;
        }
      }
      if (!cancelled) setActiveCutoutUrl(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [cutoutKey]);

  // Build a clip mask once per scene asset set (external image load → effect is correct).
  // Stabilize mask URL list so a new array identity each render doesn't re-trigger.
  const maskKey = clipMaskUrls.join("|");
  useEffect(() => {
    let cancelled = false;
    const urls = maskKey ? maskKey.split("|") : [];
    void (async () => {
      const url = await buildClipMaskDataUrl(
        sceneWidth,
        sceneHeight,
        urls,
        activeCutoutUrl
      );
      if (!cancelled) setClipMaskUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [sceneWidth, sceneHeight, activeCutoutUrl, maskKey]);

  const clientToScene = useCallback(
    (clientX: number, clientY: number) => {
      const el = boardRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  const addBlockFromSwatch = useCallback(
    (swatch: CatalogSwatch, at?: { x: number; y: number }) => {
      const w = sceneWidth * 0.28;
      const h = sceneHeight * 0.35;
      const x = at ? at.x - w / 2 : sceneWidth * 0.1 + blocks.length * 24;
      const y = at ? at.y - h / 2 : sceneHeight * 0.2 + blocks.length * 18;
      const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), -1);
      const block: ColourBlock = {
        id: uid(),
        hex: swatch.hex,
        imageUrl: swatch.imageUrl,
        ...clampBlock(x, y, w, h, sceneWidth, sceneHeight),
        z: maxZ + 1,
      };
      onChange(normalizeZ([...blocks, block]));
      setSelectedId(block.id);
    },
    [blocks, onChange, sceneWidth, sceneHeight]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<ColourBlock>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [blocks, onChange]
  );

  const removeBlock = useCallback(
    (id: string) => {
      onChange(normalizeZ(blocks.filter((b) => b.id !== id)));
      if (selectedId === id) setSelectedId(null);
    },
    [blocks, onChange, selectedId]
  );

  /** Swap selected block one step toward the front in visual stack. */
  const bringForward = useCallback(
    (id: string) => {
      const sorted = [...blocks].sort((a, b) => a.z - b.z);
      const idx = sorted.findIndex((b) => b.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return;
      const a = sorted[idx];
      const b = sorted[idx + 1];
      onChange(
        normalizeZ(
          blocks.map((blk) => {
            if (blk.id === a.id) return { ...blk, z: b.z };
            if (blk.id === b.id) return { ...blk, z: a.z };
            return blk;
          })
        )
      );
    },
    [blocks, onChange]
  );

  /** Swap selected block one step toward the back in visual stack. */
  const sendBack = useCallback(
    (id: string) => {
      const sorted = [...blocks].sort((a, b) => a.z - b.z);
      const idx = sorted.findIndex((b) => b.id === id);
      if (idx <= 0) return;
      const a = sorted[idx];
      const b = sorted[idx - 1];
      onChange(
        normalizeZ(
          blocks.map((blk) => {
            if (blk.id === a.id) return { ...blk, z: b.z };
            if (blk.id === b.id) return { ...blk, z: a.z };
            return blk;
          })
        )
      );
    },
    [blocks, onChange]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const { x, y } = clientToScene(e.clientX, e.clientY);
      if (drag.kind === "move") {
        updateBlock(drag.id, {
          x: Math.max(0, Math.min(x - drag.ox, sceneWidth - MIN_BLOCK)),
          y: Math.max(0, Math.min(y - drag.oy, sceneHeight - MIN_BLOCK)),
        });
        return;
      }

      const { handle, startX, startY, startW, startH, originX, originY } = drag;
      let nx = startX;
      let ny = startY;
      let nw = startW;
      let nh = startH;
      const dx = x - originX;
      const dy = y - originY;

      if (handle.includes("e")) nw = startW + dx;
      if (handle.includes("s")) nh = startH + dy;
      if (handle.includes("w")) {
        nw = startW - dx;
        nx = startX + dx;
      }
      if (handle.includes("n")) {
        nh = startH - dy;
        ny = startY + dy;
      }

      updateBlock(drag.id, clampBlock(nx, ny, nw, nh, sceneWidth, sceneHeight));
    },
    [drag, clientToScene, updateBlock, sceneWidth, sceneHeight]
  );

  const endDrag = useCallback(() => setDrag(null), []);

  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.z - b.z), [blocks]);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const selectedStackIndex = selected
    ? sortedBlocks.findIndex((b) => b.id === selected.id)
    : -1;
  const canForward = selectedStackIndex >= 0 && selectedStackIndex < sortedBlocks.length - 1;
  const canBack = selectedStackIndex > 0;

  const maskStyle: React.CSSProperties | undefined = clipMaskUrl
    ? {
        WebkitMaskImage: `url(${clipMaskUrl})`,
        maskImage: `url(${clipMaskUrl})`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }
    : undefined;

  const handles: ResizeHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

  function handleStyle(h: ResizeHandle): React.CSSProperties {
    const half = HANDLE_PX / 2;
    const base: React.CSSProperties = {
      position: "absolute",
      width: HANDLE_PX,
      height: HANDLE_PX,
      touchAction: "none",
      cursor: HANDLE_CURSORS[h],
      zIndex: 50,
    };
    if (h === "n") return { ...base, left: "50%", top: 0, transform: `translate(-50%, -${half}px)` };
    if (h === "s") return { ...base, left: "50%", bottom: 0, transform: `translate(-50%, ${half}px)` };
    if (h === "e") return { ...base, right: 0, top: "50%", transform: `translate(${half}px, -50%)` };
    if (h === "w") return { ...base, left: 0, top: "50%", transform: `translate(-${half}px, -50%)` };
    if (h === "ne") return { ...base, right: 0, top: 0, transform: `translate(${half}px, -${half}px)` };
    if (h === "nw") return { ...base, left: 0, top: 0, transform: `translate(-${half}px, -${half}px)` };
    if (h === "se") return { ...base, right: 0, bottom: 0, transform: `translate(${half}px, ${half}px)` };
    return { ...base, left: 0, bottom: 0, transform: `translate(-${half}px, ${half}px)` };
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-base">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-divider bg-marble px-4 py-3">
        <div>
          <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-brass">
            {t("multiColourTitle")}
          </p>
          <p className="mt-0.5 text-sm text-muted">{t("multiColourHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="border border-divider px-3 py-2 font-mono-data text-[10px] uppercase tracking-wider text-muted hover:text-charcoal"
          >
            {t("multiColourClear")}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="bg-brass px-4 py-2 font-mono-data text-[10px] uppercase tracking-[0.14em] text-ink"
          >
            {t("multiColourDone")}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <div
            ref={boardRef}
            className="relative touch-none border border-divider bg-marble shadow-lg"
            style={{ width: displayW, height: displayH }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={endDrag}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/x-swatch");
              if (!raw) return;
              try {
                const swatch = JSON.parse(raw) as CatalogSwatch;
                const at = clientToScene(e.clientX, e.clientY);
                addBlockFromSwatch(swatch, at);
              } catch {
                /* ignore */
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={basePhotoUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
              draggable={false}
            />

            {/* Colour blocks — always clipped to cabinet cutout / mask union */}
            <div className="absolute inset-0" style={maskStyle}>
              {sortedBlocks.map((block) => {
                const isSelected = block.id === selectedId;
                return (
                  <div
                    key={block.id}
                    className={`absolute cursor-move border-2 ${
                      isSelected ? "border-brass shadow-md" : "border-white/70"
                    }`}
                    style={{
                      left: block.x * scale,
                      top: block.y * scale,
                      width: block.w * scale,
                      height: block.h * scale,
                      zIndex: block.z + 10,
                      backgroundColor: block.hex,
                      backgroundImage: block.imageUrl ? `url(${block.imageUrl})` : undefined,
                      backgroundSize: "cover",
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      setSelectedId(block.id);
                      const { x, y } = clientToScene(e.clientX, e.clientY);
                      setDrag({
                        kind: "move",
                        id: block.id,
                        ox: x - block.x,
                        oy: y - block.y,
                      });
                    }}
                  />
                );
              })}
            </div>

            {/* Cutout / mask reference overlay — shows where cabinets (holes) are */}
            {activeCutoutUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeCutoutUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                draggable={false}
                style={{ zIndex: 40 }}
              />
            )}
            {!activeCutoutUrl && clipMaskUrl && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  zIndex: 40,
                  backgroundColor: "rgba(196, 149, 74, 0.22)",
                  WebkitMaskImage: `url(${clipMaskUrl})`,
                  maskImage: `url(${clipMaskUrl})`,
                  WebkitMaskSize: "100% 100%",
                  maskSize: "100% 100%",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                }}
              />
            )}

            {/* Selection chrome + resize handles sit ABOVE the cutout so they're always grabable */}
            {selected && (
              <div
                className="pointer-events-none absolute border-2 border-brass"
                style={{
                  left: selected.x * scale,
                  top: selected.y * scale,
                  width: selected.w * scale,
                  height: selected.h * scale,
                  zIndex: 45,
                }}
              >
                {handles.map((h) => (
                  <div
                    key={h}
                    role="presentation"
                    className="pointer-events-auto flex items-center justify-center"
                    style={handleStyle(h)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      setDrag({
                        kind: "resize",
                        id: selected.id,
                        handle: h,
                        startX: selected.x,
                        startY: selected.y,
                        startW: selected.w,
                        startH: selected.h,
                        originX: clientToScene(e.clientX, e.clientY).x,
                        originY: clientToScene(e.clientX, e.clientY).y,
                      });
                    }}
                  >
                    <span className="h-3.5 w-3.5 rounded-sm border border-white bg-brass shadow" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col border-t border-divider bg-marble lg:w-[300px] lg:border-l lg:border-t-0">
          {selectedId && (
            <div className="space-y-2 border-b border-divider p-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canForward}
                  className="flex-1 border border-divider py-2 font-mono-data text-[9px] uppercase disabled:opacity-40"
                  onClick={() => bringForward(selectedId)}
                >
                  {t("multiColourForward")}
                </button>
                <button
                  type="button"
                  disabled={!canBack}
                  className="flex-1 border border-divider py-2 font-mono-data text-[9px] uppercase disabled:opacity-40"
                  onClick={() => sendBack(selectedId)}
                >
                  {t("multiColourBack")}
                </button>
                <button
                  type="button"
                  className="border border-divider px-3 py-2 font-mono-data text-[9px] uppercase text-brass"
                  onClick={() => removeBlock(selectedId)}
                >
                  {t("multiColourRemove")}
                </button>
              </div>
              {blocks.length > 1 && selectedStackIndex >= 0 && (
                <p className="font-mono-data text-[9px] text-muted">
                  {t("multiColourLayerOf", {
                    n: selectedStackIndex + 1,
                    total: blocks.length,
                  })}
                </p>
              )}
            </div>
          )}

          {woodCatalogs.length > 1 && (
            <select
              value={activeCatalog?.id ?? ""}
              onChange={(e) => setCatalogId(e.target.value)}
              className="m-3 rounded-sm border border-divider bg-white px-2 py-2 font-mono-data text-[10px]"
            >
              {woodCatalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          )}

          <p className="px-3 pb-2 font-mono-data text-[9px] uppercase tracking-wider text-muted">
            {t("multiColourDragSwatch")}
          </p>
          <div className="grid grid-cols-3 gap-2 overflow-y-auto px-3 pb-6 sm:grid-cols-4 lg:grid-cols-3">
            {swatches.map((sw) => (
              <button
                key={sw.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-swatch", JSON.stringify(sw));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addBlockFromSwatch(sw)}
                className="flex flex-col items-center gap-1 rounded-sm border border-divider bg-white p-1.5 hover:border-brass/50"
                title={sw.name}
              >
                <SwatchThumb
                  hex={sw.hex}
                  imageUrl={sw.imageUrl}
                  thumbUrl={sw.thumbUrl}
                  name={sw.name}
                  className="h-12 w-full"
                  rounded="sm"
                />
                <span className="w-full truncate font-mono-data text-[8px] text-muted">
                  {sw.sheetCode}
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
