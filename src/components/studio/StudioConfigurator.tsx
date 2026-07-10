"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useConfigurator } from "@/hooks/useConfigurator";
import { DoubleShadePicker } from "@/components/DoubleShadePicker";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { SceneSidebar } from "@/components/studio/SceneSidebar";
import { StudioToolbar } from "@/components/studio/StudioToolbar";
import { StudioZonePicker } from "@/components/studio/StudioZonePicker";
import { MaterialCatalogGrid } from "@/components/studio/MaterialCatalogGrid";
import { nameFromHex, sheetCodeFromHex } from "@/lib/estimate";
import { buildWhatsAppMessage, downloadDataUrl, whatsappUrl } from "@/lib/share";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { hasDoubleShade, resolveWoodPair } from "@/lib/scenes/zones";
import { roomLabel } from "@/lib/i18n/translations";
import type { SceneConfig, ZonePalette } from "@/lib/scenes/types";
import type { SceneRecord } from "@/lib/scenes/types";
import { ApplyingOverlay } from "@/components/ApplyingOverlay";
import { CabinetMultiColourEditor } from "@/components/studio/CabinetMultiColourEditor";
import { ZoneSplitOverlay } from "@/components/studio/ZoneSplitOverlay";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";
import type { FinishMode, LightingMode, ZoneBoundingBox } from "@/lib/canvas/engine";
import {
  sceneHasCabinetMultiColour,
  type ColourBlock,
} from "@/lib/canvas/colour-board";
import {
  addSplitSegment,
  autoOrientation,
  createInitialSplit,
  isActiveSplit,
  moveSplitDivider,
  removeSplitSegment,
  updateSplitSegment,
  MAX_SPLIT_SEGMENTS,
} from "@/lib/canvas/colour-split";

interface StudioConfiguratorProps {
  scene: SceneConfig;
  sceneRecord: SceneRecord;
  categoryScenes: SceneRecord[];
  catalogs: Catalog[];
  sceneLinkPrefix?: string;
}

function firstWoodZoneId(scene: SceneConfig): string {
  return scene.zones.find((z) => z.palette === "wood")?.id ?? scene.zones[0]?.id ?? "";
}

function catalogsForPalette(catalogs: Catalog[], palette: ZonePalette): Catalog[] {
  return catalogs.filter((c) => c.swatches.some((s) => s.palette === palette));
}

function defaultCatalogForPalette(catalogs: Catalog[], palette: ZonePalette): string {
  const matching = catalogsForPalette(catalogs, palette);
  if (palette === "wood") {
    return (
      matching.find((c) => c.id === "zrk-group")?.id ??
      matching.find((c) => c.id === "artisan-laminates")?.id ??
      matching[0]?.id ??
      ""
    );
  }
  return matching[0]?.id ?? catalogs[0]?.id ?? "";
}

export function StudioConfigurator({
  scene,
  sceneRecord,
  categoryScenes,
  catalogs,
  sceneLinkPrefix = "/configurator",
}: StudioConfiguratorProps) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeZone, setActiveZone] = useState(() => firstWoodZoneId(scene));
  const [selectedCatalogId, setSelectedCatalogId] = useState(() =>
    defaultCatalogForPalette(catalogs, "wood")
  );
  const [studioMode, setStudioMode] = useState<"kitchen" | "multiColour">("kitchen");
  const [draftBoard, setDraftBoard] = useState<ColourBlock[]>([]);
  const [splitBox, setSplitBox] = useState<ZoneBoundingBox | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [splitDragging, setSplitDragging] = useState(false);

  const canMultiColour = sceneHasCabinetMultiColour(scene.zones);

  const sceneCatalogs = useMemo(
    () =>
      catalogs.filter(
        (c) =>
          c.global || !scene.catalogIds?.length || scene.catalogIds.includes(c.id)
      ),
    [catalogs, scene.catalogIds]
  );

  const activeZoneConfig = useMemo(
    () => scene.zones.find((z) => z.id === activeZone),
    [scene.zones, activeZone]
  );
  const activePalette: ZonePalette = activeZoneConfig?.palette ?? "wood";
  const paletteCatalogs = useMemo(
    () => catalogsForPalette(sceneCatalogs, activePalette),
    [sceneCatalogs, activePalette]
  );

  const showDoubleShade = hasDoubleShade(scene.zones);
  const woodPair = useMemo(() => resolveWoodPair(scene.zones), [scene.zones]);

  // Re-pick a valid default catalog whenever the active zone's palette changes
  // (e.g. wood -> paint) — React's documented "adjust state when a prop
  // changes" pattern (state tracker, not a ref, so it's safe during render).
  const [prevPalette, setPrevPalette] = useState(activePalette);
  if (prevPalette !== activePalette) {
    setPrevPalette(activePalette);
    if (!paletteCatalogs.some((c) => c.id === selectedCatalogId)) {
      setSelectedCatalogId(defaultCatalogForPalette(paletteCatalogs, activePalette));
    }
  }

  const {
    canvasRef,
    ready,
    applying,
    error,
    state,
    setZoneFromSwatch,
    setZoneColors,
    setCabinetColourBoard,
    setZoneSplit,
    getZoneBoundingBox,
    setFinish,
    setLighting,
    exportPng,
    resetColors,
  } = useConfigurator(scene);

  const activeSplit = state.zoneSplits[activeZone];
  const hasActiveSplit = isActiveSplit(activeSplit);

  const allSwatches = sceneCatalogs.flatMap((c) => c.swatches);
  const activeHex = state.zoneColors[activeZone] ?? "#3D4555";
  const selectedName = nameFromHex(activeHex, allSwatches);
  const materialCode = sheetCodeFromHex(activeHex, allSwatches);

  const sceneIndex = categoryScenes.findIndex((s) => s.id === scene.id);
  const hasPrev = sceneIndex > 0;
  const hasNext = sceneIndex < categoryScenes.length - 1;

  const handleDownload = useCallback(() => {
    const data = exportPng();
    if (!data) return;
    downloadDataUrl(data, `design-${scene.id}-${Date.now()}.png`);
  }, [exportPng, scene.id]);

  const handleWhatsApp = useCallback(() => {
    const msg = buildWhatsAppMessage(state.zoneColors, scene.zones, allSwatches);
    window.open(whatsappUrl(msg), "_blank", "noopener");
  }, [state.zoneColors, scene.zones, allSwatches]);

  const handleFullscreen = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }, []);

  const goToScene = useCallback(
    (offset: number) => {
      const target = categoryScenes[sceneIndex + offset];
      if (target) router.push(`${sceneLinkPrefix}/${target.id}`);
    },
    [categoryScenes, sceneIndex, router, sceneLinkPrefix]
  );

  const categoryLabel = roomLabel(lang, sceneRecord.category);

  const openMultiColour = useCallback(() => {
    setDraftBoard(state.cabinetColourBoard.map((b) => ({ ...b })));
    setStudioMode("multiColour");
  }, [state.cabinetColourBoard]);

  const finishMultiColour = useCallback(() => {
    setCabinetColourBoard(draftBoard);
    setStudioMode("kitchen");
  }, [draftBoard, setCabinetColourBoard]);

  // Reset segment selection whenever the active zone changes (each zone has
  // its own split) — React's documented "adjust state when a prop changes"
  // pattern (state tracker, not a ref, so it's safe during render).
  const [prevActiveZone, setPrevActiveZone] = useState(activeZone);
  if (prevActiveZone !== activeZone) {
    setPrevActiveZone(activeZone);
    setActiveSegmentId(null);
  }

  // Zone bounding box only needs to be known once split mode is active for this zone
  // (positions the draggable divider overlay over the live preview) — this reads from
  // the imperative renderer/canvas, a genuine external system, so an effect is correct here.
  useEffect(() => {
    if (!ready || !hasActiveSplit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSplitBox(null);
      return;
    }
    setSplitBox(getZoneBoundingBox(activeZone));
  }, [ready, hasActiveSplit, activeZone, getZoneBoundingBox]);

  const startSplit = useCallback(() => {
    const box = getZoneBoundingBox(activeZone);
    const initial = createInitialSplit(activeHex);
    let next = addSplitSegment(initial, "#C9C2B3");
    if (box) next = { ...next, orientation: autoOrientation(box) };
    setZoneSplit(activeZone, next);
    setSplitBox(box);
    setActiveSegmentId(next.segments[1]?.id ?? null);
  }, [activeZone, activeHex, getZoneBoundingBox, setZoneSplit]);

  const addSegment = useCallback(() => {
    if (!activeSplit) return;
    const next = addSplitSegment(activeSplit, "#C9C2B3");
    setZoneSplit(activeZone, next);
    const added = next.segments[next.segments.length - 1];
    if (added && added.id !== activeSplit.segments[activeSplit.segments.length - 1]?.id) {
      setActiveSegmentId(added.id);
    }
  }, [activeSplit, activeZone, setZoneSplit]);

  const removeSegment = useCallback(
    (id: string) => {
      if (!activeSplit) return;
      const index = activeSplit.segments.findIndex((s) => s.id === id);
      if (index < 0) return;
      if (activeSplit.segments.length <= 2) {
        setZoneSplit(activeZone, undefined);
        setActiveSegmentId(null);
        return;
      }
      setZoneSplit(activeZone, removeSplitSegment(activeSplit, index));
      if (activeSegmentId === id) setActiveSegmentId(null);
    },
    [activeSplit, activeSegmentId, activeZone, setZoneSplit]
  );

  const clearSplit = useCallback(() => {
    setZoneSplit(activeZone, undefined);
    setActiveSegmentId(null);
  }, [activeZone, setZoneSplit]);

  const handleDividerDrag = useCallback(
    (index: number, fraction: number) => {
      if (!activeSplit) return;
      setZoneSplit(activeZone, moveSplitDivider(activeSplit, index, fraction));
    },
    [activeSplit, activeZone, setZoneSplit]
  );

  const handleSegmentPick = useCallback(
    (swatch: CatalogSwatch) => {
      if (!activeSplit || !activeSegmentId) return;
      setZoneSplit(
        activeZone,
        updateSplitSegment(activeSplit, activeSegmentId, {
          hex: swatch.hex,
          imageUrl: swatch.imageUrl,
        })
      );
    },
    [activeSplit, activeSegmentId, activeZone, setZoneSplit]
  );

  const handleColorPick = useCallback(
    (swatch: CatalogSwatch) => {
      if (hasActiveSplit && activeSegmentId) {
        handleSegmentPick(swatch);
      } else if (activeZone) {
        void setZoneFromSwatch(activeZone, swatch);
      }
      setMobileOpen(false);
    },
    [activeZone, setZoneFromSwatch, hasActiveSplit, activeSegmentId, handleSegmentPick]
  );

  const lookPanel = (
    <div className="space-y-4 p-4">
      <ToggleSwitch
        label={t("finish")}
        options={[
          { value: "matt", label: t("finishMatt") },
          { value: "glossy", label: t("finishGlossy") },
        ]}
        value={state.finish}
        onChange={(v) => setFinish(v as FinishMode)}
      />
      <ToggleSwitch
        label={t("lighting")}
        options={[
          { value: "day", label: t("lightingDay") },
          { value: "night", label: t("lightingNight") },
        ]}
        value={state.lighting}
        onChange={(v) => setLighting(v as LightingMode)}
      />
      <div className="flex flex-col gap-2 pt-1">
        {canMultiColour && (
          <button
            type="button"
            disabled={!ready}
            onClick={openMultiColour}
            className="w-full border border-dashed border-divider py-2.5 font-mono-data text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-brass hover:text-brass disabled:opacity-40"
          >
            {t("multiColourAdvancedButton")}
            {state.cabinetColourBoard.length > 0
              ? ` (${state.cabinetColourBoard.length})`
              : ""}
          </button>
        )}
        <button
          type="button"
          disabled={!ready}
          onClick={handleDownload}
          className="btn-shine w-full bg-brass py-3 font-mono-data text-[10px] uppercase tracking-[0.14em] text-ink disabled:opacity-40"
        >
          {t("downloadDesign")}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={handleWhatsApp}
          className="w-full border border-brass/50 py-3 font-mono-data text-[10px] uppercase tracking-[0.14em] text-brass transition-colors hover:bg-brass/10 disabled:opacity-40"
        >
          {t("sendWhatsApp")}
        </button>
      </div>
    </div>
  );

  const splitPanel = (
    <div className="border-b border-divider p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono-data text-[9px] uppercase tracking-[0.2em] text-muted">
          {t("splitTitle")}
        </p>
        {hasActiveSplit && (
          <button
            type="button"
            onClick={clearSplit}
            className="font-mono-data text-[9px] uppercase tracking-wider text-brass hover:underline"
          >
            {t("splitClear")}
          </button>
        )}
      </div>

      {!hasActiveSplit ? (
        <button
          type="button"
          disabled={!ready}
          onClick={startSplit}
          className="mt-2 w-full border border-brass/50 py-2.5 font-mono-data text-[10px] uppercase tracking-wider text-brass transition-colors hover:bg-brass/10 disabled:opacity-40"
        >
          {t("splitStart")}
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeSplit!.segments.map((seg, i) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setActiveSegmentId(seg.id)}
                title={`${t("splitSegment")} ${i + 1}`}
                className={`relative h-11 w-11 rounded-sm border-2 transition-colors ${
                  activeSegmentId === seg.id ? "border-brass shadow-md" : "border-divider"
                }`}
                style={{
                  backgroundColor: seg.hex,
                  backgroundImage: seg.imageUrl ? `url(${seg.imageUrl})` : undefined,
                  backgroundSize: "cover",
                }}
              >
                <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-charcoal font-mono-data text-[8px] text-white">
                  {i + 1}
                </span>
                <span
                  role="button"
                  aria-label={t("splitRemoveColour")}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSegment(seg.id);
                  }}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-charcoal text-[9px] leading-none text-white hover:bg-brass"
                >
                  ×
                </span>
              </button>
            ))}
            {activeSplit!.segments.length < MAX_SPLIT_SEGMENTS && (
              <button
                type="button"
                onClick={addSegment}
                aria-label={t("splitAddColour")}
                className="flex h-11 w-11 items-center justify-center rounded-sm border border-dashed border-divider text-muted transition-colors hover:border-brass hover:text-brass"
              >
                +
              </button>
            )}
          </div>
          <p className="font-mono-data text-[9px] leading-relaxed text-muted">
            {activeSegmentId ? t("splitPickingFor", { n: 1 + activeSplit!.segments.findIndex((s) => s.id === activeSegmentId) }) : t("splitHint")}
          </p>
        </div>
      )}
    </div>
  );

  const catalogPanel = (
    <>
      <StudioZonePicker
        zones={scene.zones}
        activeZone={activeZone}
        onSelect={setActiveZone}
      />
      {splitPanel}
      {showDoubleShade && (
        <div className="border-b border-divider p-3">
          <DoubleShadePicker
            zones={scene.zones}
            zoneColors={state.zoneColors}
            upperId={woodPair.upperId}
            lowerId={woodPair.lowerId}
            onApply={setZoneColors}
          />
        </div>
      )}
      <MaterialCatalogGrid
        catalogs={paletteCatalogs}
        selectedCatalogId={selectedCatalogId}
        onCatalogChange={setSelectedCatalogId}
        activeZonePalette={activePalette}
        selectedHex={activeHex}
        onPick={handleColorPick}
      />
      <div className="hidden border-t border-divider lg:block">{lookPanel}</div>
    </>
  );

  return (
    <div className="studio-configurator flex h-[calc(100vh-3rem)] flex-col bg-base">
      {studioMode === "multiColour" && (
        <CabinetMultiColourEditor
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          basePhotoUrl={scene.basePhoto}
          blocks={draftBoard}
          onChange={setDraftBoard}
          catalogs={sceneCatalogs}
          onDone={finishMultiColour}
          onClear={() => {
            setDraftBoard([]);
            setCabinetColourBoard([]);
          }}
        />
      )}
      <StudioToolbar
        sceneName={scene.name}
        zoneLabel={activeZoneConfig?.label ?? ""}
        materialCode={materialCode}
        materialName={selectedName}
        ready={ready}
        onDownload={handleDownload}
        onReset={resetColors}
        onFullscreen={handleFullscreen}
        onPrevScene={() => goToScene(-1)}
        onNextScene={() => goToScene(1)}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block">
          <SceneSidebar
            scenes={categoryScenes}
            activeId={scene.id}
            categoryLabel={categoryLabel}
            linkPrefix={sceneLinkPrefix}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-center gap-3 border-b border-divider bg-base px-4 py-2">
            <p className="studio-panel-label">{t("livePreview")}</p>
            {canMultiColour && (
              <button
                type="button"
                disabled={!ready}
                onClick={openMultiColour}
                className="rounded-sm border border-divider px-2.5 py-1 font-mono-data text-[9px] uppercase tracking-wider text-muted hover:border-brass hover:text-brass disabled:opacity-40"
              >
                {t("multiColourAdvancedButton")}
              </button>
            )}
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
            <motion.div
              ref={previewRef}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="studio-preview-frame relative w-full max-w-4xl overflow-hidden border border-divider bg-marble shadow-[0_20px_60px_rgba(28,20,16,0.1)]"
            >
              <canvas ref={canvasRef} className="block h-auto w-full" />
              {hasActiveSplit && splitBox && (
                <ZoneSplitOverlay
                  containerRef={previewRef}
                  sceneWidth={scene.width}
                  sceneHeight={scene.height}
                  box={splitBox}
                  split={activeSplit!}
                  onDragDivider={handleDividerDrag}
                  onDragStart={() => setSplitDragging(true)}
                  onDragEnd={() => setSplitDragging(false)}
                />
              )}
              <ApplyingOverlay show={applying && !splitDragging} />
              {!ready && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base/90">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brass border-t-transparent" />
                  <p className="font-mono-data text-xs text-muted">{t("loadingScene")}</p>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base/95 p-6 text-center">
                  <p className="text-sm text-brass">{t("photosLoadFailed")}</p>
                  <p className="font-mono-data text-xs text-muted">{error}</p>
                </div>
              )}
            </motion.div>
          </div>

          <div className="flex gap-2 border-t border-divider bg-marble p-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex-1 bg-brass py-3 font-mono-data text-[10px] uppercase tracking-[0.12em] text-ink"
            >
              {materialCode ??
                t("coloursMobile", {
                  zone: activeZoneConfig?.label ?? "",
                  name: selectedName,
                })}
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={handleDownload}
              className="border border-divider px-4 py-3 font-mono-data text-[10px] uppercase tracking-wider text-muted disabled:opacity-40"
            >
              {t("downloadShort")}
            </button>
          </div>
        </div>

        <aside className="studio-catalog hidden w-[280px] shrink-0 flex-col overflow-y-auto border-l border-divider bg-marble lg:flex">
          {catalogPanel}
        </aside>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-walnut/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto bg-marble shadow-2xl lg:hidden"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-divider bg-marble px-4 py-3">
                <span className="font-display text-sm">{t("materialCatalog")}</span>
                <button type="button" onClick={() => setMobileOpen(false)} className="text-muted">
                  ✕
                </button>
              </div>
              {catalogPanel}
              <div className="border-t border-divider lg:hidden">{lookPanel}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
