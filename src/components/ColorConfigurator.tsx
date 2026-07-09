"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfigurator } from "@/hooks/useConfigurator";
import { ColorCatalog } from "@/components/ColorCatalog";
import { ControlPanel } from "@/components/ControlPanel";
import { ApplyingOverlay } from "@/components/ApplyingOverlay";
import { ZonePicker } from "@/components/ZonePicker";
import { DoubleShadePicker } from "@/components/DoubleShadePicker";
import { nameFromHex } from "@/lib/estimate";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { hasDoubleShade, resolveWoodPair } from "@/lib/scenes/zones";
import type { SceneConfig } from "@/lib/scenes/types";
import type { ZonePalette } from "@/lib/scenes/types";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";

interface ColorConfiguratorProps {
  scene: SceneConfig;
  catalogs: Catalog[];
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
    return matching.find((c) => c.id === "artisan-laminates")?.id ?? matching[0]?.id ?? "";
  }
  return matching[0]?.id ?? catalogs[0]?.id ?? "";
}

export function ColorConfigurator({ scene, catalogs }: ColorConfiguratorProps) {
  const { t } = useLanguage();
  const [mobileCatalog, setMobileCatalog] = useState(false);
  const [activeZone, setActiveZone] = useState(() => firstWoodZoneId(scene));
  const [selectedCatalogId, setSelectedCatalogId] = useState(() =>
    defaultCatalogForPalette(catalogs, "wood")
  );

  const sceneCatalogs = useMemo(
    () =>
      catalogs.filter(
        (c) =>
          c.global ||
          !scene.catalogIds?.length ||
          scene.catalogIds.includes(c.id)
      ),
    [catalogs, scene.catalogIds]
  );

  const activeZoneConfig = scene.zones.find((z) => z.id === activeZone);
  const activePalette = activeZoneConfig?.palette ?? "wood";
  const paletteCatalogs = useMemo(
    () => catalogsForPalette(sceneCatalogs, activePalette),
    [sceneCatalogs, activePalette]
  );

  const showDoubleShade = hasDoubleShade(scene.zones);
  const woodPair = useMemo(() => resolveWoodPair(scene.zones), [scene.zones]);

  useEffect(() => {
    if (!paletteCatalogs.some((c) => c.id === selectedCatalogId)) {
      setSelectedCatalogId(defaultCatalogForPalette(paletteCatalogs, activePalette));
    }
  }, [activePalette, paletteCatalogs, selectedCatalogId]);

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
  } = useConfigurator(scene);

  const activeHex = state.zoneColors[activeZone] ?? "#3D4555";
  const allSwatches = sceneCatalogs.flatMap((c) => c.swatches);
  const selectedName = nameFromHex(activeHex, allSwatches);

  const handleColorPick = (swatch: CatalogSwatch) => {
    if (activeZone) void setZoneFromSwatch(activeZone, swatch);
    setMobileCatalog(false);
  };

  const catalogBlock = (
    <>
      {showDoubleShade && (
        <DoubleShadePicker
          zones={scene.zones}
          zoneColors={state.zoneColors}
          upperId={woodPair.upperId}
          lowerId={woodPair.lowerId}
          onApply={setZoneColors}
        />
      )}
      <ColorCatalog
        catalogs={paletteCatalogs}
        selectedCatalogId={selectedCatalogId}
        onCatalogChange={setSelectedCatalogId}
        activeZonePalette={activePalette}
        selectedHex={activeHex}
        onPick={handleColorPick}
      />
      <p className="mt-4 rounded-sm border border-divider bg-base px-3 py-2 font-mono-data text-xs text-charcoal">
        <span className="text-muted">{activeZoneConfig?.label}:</span>{" "}
        <span className="text-brass">{selectedName}</span>
      </p>
    </>
  );

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <ZonePicker
        zones={scene.zones}
        activeZone={activeZone}
        onSelect={setActiveZone}
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="hidden w-full shrink-0 space-y-4 border-b border-divider bg-marble p-5 lg:block lg:w-72 lg:border-b-0 lg:border-r xl:w-80">
          {catalogBlock}
        </aside>

        <div className="relative flex flex-1 flex-col items-center justify-center bg-base p-3 pb-24 lg:pb-3">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-sm border border-divider bg-marble shadow-sm">
            <canvas ref={canvasRef} className="block h-auto w-full" />
            <ApplyingOverlay show={applying} />
            {!ready && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-base/90 p-6 text-center">
                <p className="font-mono-data text-sm text-muted">{t("loadingScene")}</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base/95 p-6 text-center">
                <p className="text-sm text-brass">{t("photosLoadFailed")}</p>
                <p className="font-mono-data text-xs leading-relaxed text-muted">{error}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileCatalog(true)}
            className="mt-3 rounded-sm bg-brass px-5 py-2.5 font-mono-data text-xs text-marble lg:hidden"
          >
            {t("coloursMobile", {
              zone: activeZoneConfig?.label ?? "",
              name: selectedName,
            })}
          </button>
        </div>

        <ControlPanel
          scene={scene}
          zoneColors={state.zoneColors}
          finish={state.finish}
          lighting={state.lighting}
          ready={ready}
          swatches={allSwatches}
          onFinish={setFinish}
          onLighting={setLighting}
          exportPng={exportPng}
        />
      </div>

      <AnimatePresence>
        {mobileCatalog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-walnut/40 lg:hidden"
              onClick={() => setMobileCatalog(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] space-y-4 overflow-y-auto rounded-t-lg bg-marble p-5 shadow-2xl lg:hidden"
            >
              {catalogBlock}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
