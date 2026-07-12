"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToggleSwitch } from "./ToggleSwitch";
import { buildWhatsAppMessage, downloadDataUrl, whatsappUrl } from "@/lib/share";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { ZoneColors } from "@/lib/canvas/engine";
import type { FinishMode, LightingMode } from "@/lib/canvas/engine";
import type { SceneConfig } from "@/lib/scenes/types";
import type { CatalogSwatch } from "@/lib/catalogs/types";

interface ControlPanelProps {
  scene: SceneConfig;
  zoneColors: ZoneColors;
  finish: FinishMode;
  lighting: LightingMode;
  ready: boolean;
  swatches: CatalogSwatch[];
  onFinish: (f: FinishMode) => void;
  onLighting: (l: LightingMode) => void;
  exportPng: () => string | null;
}

export function ControlPanel({
  scene,
  zoneColors,
  finish,
  lighting,
  ready,
  swatches,
  onFinish,
  onLighting,
  exportPng,
}: ControlPanelProps) {
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDownload = () => {
    const data = exportPng();
    if (!data) return;
    downloadDataUrl(data, `artisan-${scene.id}-${Date.now()}.png`);
  };

  const handleWhatsApp = () => {
    const msg = buildWhatsAppMessage(zoneColors, scene.zones, swatches);
    window.open(whatsappUrl(msg), "_blank", "noopener");
  };

  const panel = (
    <div className="space-y-6">
      <p className="font-mono-data text-[10px] uppercase tracking-[0.2em] text-brass">
        {t("lookShare")}
      </p>

      <div className="space-y-3">
        <ToggleSwitch
          label={t("finish")}
          options={[
            { value: "matt", label: t("finishMatt") },
            { value: "glossy", label: t("finishGlossy") },
          ]}
          value={finish}
          onChange={(v) => onFinish(v as FinishMode)}
        />
        <ToggleSwitch
          label={t("lighting")}
          options={[
            { value: "day", label: t("lightingDay") },
            { value: "night", label: t("lightingNight") },
          ]}
          value={lighting}
          onChange={(v) => onLighting(v as LightingMode)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={handleDownload}
          className="btn-shine w-full bg-ink py-3 text-sm font-medium text-paper disabled:opacity-50"
        >
          {t("downloadDesign")}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={handleWhatsApp}
          className="w-full border border-ink/40 py-3 text-sm font-medium text-ink disabled:opacity-50"
        >
          {t("sendWhatsApp")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-full shrink-0 border-t border-divider bg-marble p-6 lg:block lg:max-h-[calc(100vh-4rem)] lg:max-w-xs lg:overflow-y-auto lg:border-l lg:border-t-0 xl:max-w-sm">
        {panel}
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 bg-walnut px-6 py-3 font-mono-data text-xs uppercase tracking-wider text-marble shadow-lg lg:hidden"
      >
        {t("lookShare")}
      </button>

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
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[75vh] overflow-y-auto bg-marble p-6 shadow-2xl lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg">{t("lookShare")}</span>
                <button type="button" onClick={() => setMobileOpen(false)} className="text-muted">
                  ✕
                </button>
              </div>
              {panel}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
