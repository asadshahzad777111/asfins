"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { SwatchThumb } from "@/components/SwatchThumb";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { ColourBlock } from "@/lib/canvas/colour-board";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";

interface CabinetMultiColourEditorProps {
  sceneWidth: number;
  sceneHeight: number;
  basePhotoUrl: string;
  blocks: ColourBlock[];
  onChange: (blocks: ColourBlock[]) => void;
  catalogs: Catalog[];
  onDone: () => void;
  onClear: () => void;
}

type DragMode =
  | { kind: "move"; id: string; ox: number; oy: number; startX: number; startY: number }
  | { kind: "resize"; id: string; startW: number; startH: number; startX: number; startY: number }
  | null;

function uid() {
  return `cb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CabinetMultiColourEditor({
  sceneWidth,
  sceneHeight,
  basePhotoUrl,
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
    // Fit board into ~min(90vw, 900px) width
    const maxW = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.9 : 900, 900);
    return maxW / Math.max(sceneWidth, 1);
  }, [sceneWidth]);

  const displayW = sceneWidth * scale;
  const displayH = sceneHeight * scale;

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
      const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), 0);
      const block: ColourBlock = {
        id: uid(),
        hex: swatch.hex,
        imageUrl: swatch.imageUrl,
        x: Math.max(0, Math.min(x, sceneWidth - w)),
        y: Math.max(0, Math.min(y, sceneHeight - h)),
        w,
        h,
        z: maxZ + 1,
      };
      onChange([...blocks, block]);
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
      onChange(blocks.filter((b) => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [blocks, onChange, selectedId]
  );

  const bringForward = useCallback(
    (id: string) => {
      const maxZ = blocks.reduce((m, b) => Math.max(m, b.z), 0);
      updateBlock(id, { z: maxZ + 1 });
    },
    [blocks, updateBlock]
  );

  const sendBack = useCallback(
    (id: string) => {
      const minZ = blocks.reduce((m, b) => Math.min(m, b.z), 0);
      updateBlock(id, { z: minZ - 1 });
    },
    [blocks, updateBlock]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const { x, y } = clientToScene(e.clientX, e.clientY);
      if (drag.kind === "move") {
        updateBlock(drag.id, {
          x: Math.max(0, Math.min(x - drag.ox, sceneWidth - 40)),
          y: Math.max(0, Math.min(y - drag.oy, sceneHeight - 40)),
        });
      } else if (drag.kind === "resize") {
        const nw = Math.max(40, Math.min(sceneWidth - drag.startX, x - drag.startX));
        const nh = Math.max(40, Math.min(sceneHeight - drag.startY, y - drag.startY));
        updateBlock(drag.id, { w: nw, h: nh });
      }
    },
    [drag, clientToScene, updateBlock, sceneWidth, sceneHeight]
  );

  const endDrag = useCallback(() => setDrag(null), []);

  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.z - b.z), [blocks]);

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
              className="pointer-events-none absolute inset-0 h-full w-full object-fill opacity-40"
              draggable={false}
            />
            {sortedBlocks.map((block) => {
              const selected = block.id === selectedId;
              return (
                <div
                  key={block.id}
                  className={`absolute cursor-move border-2 ${
                    selected ? "border-brass shadow-md" : "border-white/70"
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
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                    setSelectedId(block.id);
                    const { x, y } = clientToScene(e.clientX, e.clientY);
                    setDrag({
                      kind: "move",
                      id: block.id,
                      ox: x - block.x,
                      oy: y - block.y,
                      startX: block.x,
                      startY: block.y,
                    });
                  }}
                >
                  {selected && (
                    <div
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-brass"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDrag({
                          kind: "resize",
                          id: block.id,
                          startW: block.w,
                          startH: block.h,
                          startX: block.x,
                          startY: block.y,
                        });
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col border-t border-divider bg-marble lg:w-[300px] lg:border-l lg:border-t-0">
          {selectedId && (
            <div className="flex gap-2 border-b border-divider p-3">
              <button
                type="button"
                className="flex-1 border border-divider py-2 font-mono-data text-[9px] uppercase"
                onClick={() => bringForward(selectedId)}
              >
                {t("multiColourForward")}
              </button>
              <button
                type="button"
                className="flex-1 border border-divider py-2 font-mono-data text-[9px] uppercase"
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
