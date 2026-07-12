"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useConfigurator } from "@/hooks/useConfigurator";
import { DoubleShadePicker } from "@/components/DoubleShadePicker";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { SceneSidebar } from "@/components/studio/SceneSidebar";
import { StudioToolbar } from "@/components/studio/StudioToolbar";
import { StudioZonePicker } from "@/components/studio/StudioZonePicker";
import { ZoneHotspotOverlay } from "@/components/studio/ZoneHotspotOverlay";
import { MaterialCatalogGrid } from "@/components/studio/MaterialCatalogGrid";
import { nameFromHex, sheetCodeFromHex } from "@/lib/estimate";
import { buildWhatsAppMessage, downloadDataUrl, whatsappUrl } from "@/lib/share";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { hasDoubleShade, resolveWoodPair } from "@/lib/scenes/zones";
import { roomLabel } from "@/lib/i18n/translations";
import { catalogsForPalette } from "@/lib/catalogs/materials";
import type { SceneConfig, ZonePalette } from "@/lib/scenes/types";
import type { SceneRecord } from "@/lib/scenes/types";
import { ApplyingOverlay } from "@/components/ApplyingOverlay";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";
import type { FinishMode, LightingMode } from "@/lib/canvas/engine";

interface StudioConfiguratorProps {
  scene: SceneConfig;
  sceneRecord: SceneRecord;
  categoryScenes: SceneRecord[];
  catalogs: Catalog[];
  sceneLinkPrefix?: string;
}

const RAIL_STORAGE_KEY = "studio-kitchen-rail-open";
const SIDEBAR_WIDTH = 220;
const ease = [0.22, 1, 0.36, 1] as const;
const springRail = { type: "spring" as const, stiffness: 380, damping: 34 };

const railListeners = new Set<() => void>();

function readRailPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRailPreference(open: boolean) {
  try {
    window.localStorage.setItem(RAIL_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
  railListeners.forEach((listener) => listener());
}

function subscribeRail(onStoreChange: () => void) {
  railListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    railListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function firstZoneId(scene: SceneConfig): string {
  return scene.zones.find((z) => z.palette === "wood")?.id ?? scene.zones[0]?.id ?? "";
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
  const [mobileScenesOpen, setMobileScenesOpen] = useState(false);
  const kitchenRailOpen = useSyncExternalStore(
    subscribeRail,
    readRailPreference,
    () => false
  );
  const [activeZone, setActiveZone] = useState(() => firstZoneId(scene));
  const [advancedOptions, setAdvancedOptions] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState(() =>
    defaultCatalogForPalette(catalogs, scene.zones.find((z) => z.id === firstZoneId(scene))?.palette ?? "wood")
  );

  // Scene zones already come from uploaded cutouts only — never invent placeholder zones.
  const sceneZones = scene.zones;

  const sceneCatalogs = useMemo(
    () =>
      catalogs.filter(
        (c) =>
          c.global || !scene.catalogIds?.length || scene.catalogIds.includes(c.id)
      ),
    [catalogs, scene.catalogIds]
  );

  const activeZoneConfig = useMemo(
    () => sceneZones.find((z) => z.id === activeZone) ?? sceneZones[0],
    [sceneZones, activeZone]
  );
  const resolvedActiveZone = activeZoneConfig?.id ?? "";
  const activePalette: ZonePalette = activeZoneConfig?.palette ?? "wood";
  const paletteCatalogs = useMemo(
    () => catalogsForPalette(sceneCatalogs, activePalette),
    [sceneCatalogs, activePalette]
  );

  const showDoubleShade = hasDoubleShade(sceneZones);
  const woodPair = useMemo(() => resolveWoodPair(sceneZones), [sceneZones]);

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

  // If the scene changed (or active zone was removed), snap to a zone that exists.
  const [prevSceneId, setPrevSceneId] = useState(scene.id);
  if (prevSceneId !== scene.id) {
    setPrevSceneId(scene.id);
    setActiveZone(firstZoneId(scene));
  } else if (activeZone && sceneZones.length > 0 && !sceneZones.some((z) => z.id === activeZone)) {
    setActiveZone(sceneZones[0].id);
  }

  const {
    canvasRef,
    ready,
    applying,
    error,
    state,
    setZoneFromSwatch,
    setZoneColors,
    setFinish,
    setLighting,
    exportPng,
    resetColors,
    getZoneBoundingBox,
  } = useConfigurator(scene);

  const allSwatches = sceneCatalogs.flatMap((c) => c.swatches);
  const zoneForColors = resolvedActiveZone || activeZone;
  const activeHex = state.zoneColors[zoneForColors] ?? "#3D4555";
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
    const msg = buildWhatsAppMessage(state.zoneColors, sceneZones, allSwatches);
    window.open(whatsappUrl(msg), "_blank", "noopener");
  }, [state.zoneColors, sceneZones, allSwatches]);

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

  const handleColorPick = useCallback(
    (swatch: CatalogSwatch) => {
      if (zoneForColors) {
        void setZoneFromSwatch(zoneForColors, swatch);
      }
      setMobileOpen(false);
    },
    [zoneForColors, setZoneFromSwatch]
  );

  const handleHotspotSelect = useCallback(
    (zoneId: string) => {
      setActiveZone(zoneId);
      // Mobile: open material sheet so the customer can pick colour for that zone.
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
        setMobileOpen(true);
      }
    },
    []
  );

  const toggleKitchenRail = useCallback(() => {
    writeRailPreference(!kitchenRailOpen);
  }, [kitchenRailOpen]);

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
        <button
          type="button"
          disabled={!ready}
          onClick={handleDownload}
          className="btn-shine w-full bg-ink py-3 font-mono-data text-[10px] uppercase tracking-[0.14em] text-paper disabled:opacity-40"
        >
          {t("downloadDesign")}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={handleWhatsApp}
          className="w-full border border-ink/40 py-3 font-mono-data text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink/5 disabled:opacity-40"
        >
          {t("sendWhatsApp")}
        </button>
      </div>
    </div>
  );

  const catalogPanel = (
    <>
      <StudioZonePicker
        zones={sceneZones}
        activeZone={zoneForColors}
        onSelect={setActiveZone}
      />
      {showDoubleShade && (
        <div className="border-b border-divider p-3">
          <DoubleShadePicker
            zones={sceneZones}
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
    <div className="studio-configurator flex h-[calc(100vh-3.25rem)] flex-col bg-base">
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

      <div className="relative flex min-h-0 flex-1">
        {/* Desktop collapsible kitchen rail — closed by default; arrow opens it */}
        <div className="hidden h-full shrink-0 lg:flex">
          <AnimatePresence initial={false}>
            {kitchenRailOpen && (
              <motion.div
                key="kitchen-rail"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={springRail}
                className="h-full overflow-hidden"
              >
                <SceneSidebar
                  scenes={categoryScenes}
                  activeId={scene.id}
                  categoryLabel={categoryLabel}
                  linkPrefix={sceneLinkPrefix}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={toggleKitchenRail}
            aria-expanded={kitchenRailOpen}
            aria-label={kitchenRailOpen ? t("hideKitchenList") : t("showKitchenList")}
            title={kitchenRailOpen ? t("hideKitchenList") : t("showKitchenList")}
            className="studio-rail-toggle group relative z-20 flex h-full w-7 shrink-0 items-center justify-center border-r border-divider bg-marble text-muted transition-colors hover:border-brass hover:bg-brass/5 hover:text-brass"
          >
            <motion.span
              animate={{ rotate: kitchenRailOpen ? 0 : 180 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="flex items-center justify-center"
            >
              <ChevronIcon />
            </motion.span>
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-divider bg-base/80 px-4 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileScenesOpen(true)}
                className="studio-rail-toggle-mobile flex h-8 w-8 items-center justify-center border border-divider text-muted transition-colors hover:border-brass hover:text-brass lg:hidden"
                aria-label={t("showKitchenList")}
              >
                <ChevronIcon />
              </button>
              <p className="studio-panel-label">{t("livePreview")}</p>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {sceneZones.length > 0 && (
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-1.5"
                  title={t("advancedOptionsHint")}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-ink"
                    checked={advancedOptions}
                    onChange={(e) => setAdvancedOptions(e.target.checked)}
                  />
                  <span className="font-mono-data text-[9px] uppercase tracking-wider text-muted">
                    {t("advancedOptions")}
                  </span>
                </label>
              )}
              <motion.span
                key={scene.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
                className="truncate font-mono-data text-[9px] uppercase tracking-wider text-muted"
              >
                {scene.name}
              </motion.span>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
            <motion.div
              ref={previewRef}
              key={scene.id}
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="studio-preview-frame relative w-full max-w-5xl overflow-hidden border border-divider bg-marble shadow-[0_20px_60px_rgba(28,20,16,0.1)]"
            >
              <canvas ref={canvasRef} className="block h-auto w-full" />
              {advancedOptions && (
                <ZoneHotspotOverlay
                  scene={scene}
                  zones={sceneZones}
                  activeZone={zoneForColors}
                  ready={ready}
                  getZoneBoundingBox={getZoneBoundingBox}
                  onSelectZone={handleHotspotSelect}
                />
              )}
              <ApplyingOverlay show={applying} />
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
              onClick={() => setMobileScenesOpen(true)}
              className="border border-ink/20 bg-paper px-3 py-3 font-mono-data text-[10px] uppercase tracking-wider text-ink"
            >
              {t("scenePicker")}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="studio-mobile-cta flex-1 bg-ink py-3 font-mono-data text-[10px] uppercase tracking-[0.12em] text-paper"
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
              className="border border-ink/20 bg-paper px-4 py-3 font-mono-data text-[10px] uppercase tracking-wider text-ink disabled:opacity-40"
            >
              {t("downloadShort")}
            </button>
          </div>
        </div>

        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease }}
          className="studio-catalog hidden w-[280px] shrink-0 flex-col overflow-y-auto border-l border-divider bg-marble lg:flex"
        >
          {catalogPanel}
        </motion.aside>
      </div>

      {/* Mobile material sheet */}
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

      {/* Mobile kitchen scenes sheet */}
      <AnimatePresence>
        {mobileScenesOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-walnut/40 lg:hidden"
              onClick={() => setMobileScenesOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 340 }}
              className="fixed bottom-0 left-0 top-0 z-50 w-[min(100%,280px)] overflow-hidden bg-[#F5F0E8] shadow-2xl lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-divider px-3 py-2.5">
                  <span className="font-display text-sm text-charcoal">{t("selectRoom")}</span>
                  <button
                    type="button"
                    onClick={() => setMobileScenesOpen(false)}
                    className="flex h-8 w-8 items-center justify-center text-muted"
                    aria-label={t("hideKitchenList")}
                  >
                    ✕
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <SceneSidebar
                    scenes={categoryScenes}
                    activeId={scene.id}
                    categoryLabel={categoryLabel}
                    linkPrefix={sceneLinkPrefix}
                    onNavigate={() => setMobileScenesOpen(false)}
                    className="!w-full border-r-0"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M7.5 2.5L4 6l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
