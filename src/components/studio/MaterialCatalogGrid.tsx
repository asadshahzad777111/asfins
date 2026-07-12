"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ZrkCatalogCard } from "@/components/ZrkCatalogCard";
import { BrandLogo } from "@/components/BrandLogo";
import {
  BrandCatalogFolders,
  catalogsToFolders,
} from "@/components/BrandCatalogFolders";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";
import type { ZonePalette } from "@/lib/scenes/types";
import {
  filterSwatchesBySeries,
  groupSwatchesBySeries,
} from "@/lib/catalogs/series";

interface MaterialCatalogGridProps {
  catalogs: Catalog[];
  selectedCatalogId: string;
  onCatalogChange: (id: string) => void;
  activeZonePalette: ZonePalette;
  selectedHex: string;
  onPick: (swatch: CatalogSwatch) => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function MaterialCatalogGrid({
  catalogs,
  selectedCatalogId,
  onCatalogChange,
  activeZonePalette,
  selectedHex,
  onPick,
}: MaterialCatalogGridProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("");
  const [browsingFolders, setBrowsingFolders] = useState(catalogs.length > 1);
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);

  const folders = useMemo(() => catalogsToFolders(catalogs), [catalogs]);
  const catalog = catalogs.find((c) => c.id === selectedCatalogId) ?? catalogs[0];

  const paletteSwatches = useMemo(
    () => (catalog?.swatches ?? []).filter((s) => s.palette === activeZonePalette),
    [catalog, activeZonePalette]
  );

  const seriesFolders = useMemo(
    () => groupSwatchesBySeries(paletteSwatches),
    [paletteSwatches]
  );

  const showSeriesStep =
    !browsingFolders &&
    !openSeriesId &&
    !filter.trim() &&
    seriesFolders.length > 1;

  const swatches: CatalogSwatch[] = useMemo(() => {
    const list = openSeriesId
      ? filterSwatchesBySeries(paletteSwatches, openSeriesId)
      : paletteSwatches;
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    const qDigits = q.replace(/\D/g, "");
    const scored = list
      .map((s) => {
        const code = s.sheetCode.toLowerCase();
        const name = s.name.toLowerCase();
        const series = (s.materialCategory ?? "").toLowerCase();
        const codeDigits = code.replace(/\D/g, "");
        let score = 0;
        if (code === q || codeDigits === q || (qDigits && codeDigits === qDigits)) score = 3;
        else if (code.startsWith(q) || (qDigits && codeDigits.startsWith(qDigits))) score = 2;
        else if (
          code.includes(q) ||
          name.includes(q) ||
          series.includes(q) ||
          (qDigits && codeDigits.includes(qDigits))
        )
          score = 1;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.sheetCode.localeCompare(b.s.sheetCode));
    return scored.map((x) => x.s);
  }, [paletteSwatches, filter, openSeriesId]);

  const paletteLabel =
    activeZonePalette === "wood"
      ? t("paletteWoodLaminate")
      : activeZonePalette === "tile"
        ? t("paletteTile")
        : t("palettePaint");

  const showFolders = browsingFolders && folders.length > 1 && !filter.trim();
  const openSeries = seriesFolders.find((s) => s.id === openSeriesId) ?? null;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-divider bg-marble/95 px-4 py-3 backdrop-blur-sm">
        <p className="studio-panel-label">{t("selectMaterial")}</p>
        <p className="font-display mt-0.5 text-sm text-charcoal">{paletteLabel}</p>
      </div>

      <div className="space-y-3 p-3">
        <AnimatePresence mode="wait">
          {showFolders ? (
            <motion.div
              key="brand-folders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease }}
              className="space-y-2"
            >
              <p className="font-mono-data text-[9px] uppercase tracking-wider text-muted">
                {t("chooseBrandFolder")}
              </p>
              <BrandCatalogFolders
                folders={folders}
                columns="studio"
                onOpen={(id) => {
                  onCatalogChange(id);
                  setBrowsingFolders(false);
                  setOpenSeriesId(null);
                  setFilter("");
                }}
              />
            </motion.div>
          ) : showSeriesStep ? (
            <motion.div
              key="series-folders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease }}
              className="space-y-2"
            >
              {folders.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setBrowsingFolders(true);
                    setOpenSeriesId(null);
                    setFilter("");
                  }}
                  className="font-mono-data text-[9px] uppercase tracking-wider text-ink hover:underline"
                >
                  {t("allBrandFolders")}
                </button>
              )}
              {catalog && (
                <div className="flex items-center gap-2 px-1">
                  <BrandLogo brandName={catalog.companyName} className="h-5 w-auto" />
                  <span className="font-mono-data text-[9px] uppercase tracking-wider text-muted">
                    {catalog.companyName}
                  </span>
                </div>
              )}
              <p className="font-mono-data text-[9px] uppercase tracking-wider text-muted">
                {t("chooseSeriesFolder")}
              </p>
              <BrandCatalogFolders
                folders={seriesFolders.map((s) => ({
                  id: s.id,
                  name: s.name,
                  count: s.count,
                  previewUrl: s.previewUrl,
                  previewHex: s.previewHex,
                }))}
                columns="studio"
                hideBrandLogo
                onOpen={(id) => {
                  setOpenSeriesId(id);
                  setFilter("");
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`swatches-${selectedCatalogId}-${openSeriesId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease }}
              className="space-y-3"
            >
              {folders.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setBrowsingFolders(true);
                    setOpenSeriesId(null);
                    setFilter("");
                  }}
                  className="font-mono-data text-[9px] uppercase tracking-wider text-ink hover:underline"
                >
                  {t("allBrandFolders")}
                </button>
              )}

              {seriesFolders.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenSeriesId(null);
                    setFilter("");
                  }}
                  className="ml-2 font-mono-data text-[9px] uppercase tracking-wider text-ink hover:underline"
                >
                  {t("allSeriesFolders")}
                </button>
              )}

              {catalog && (
                <div className="flex items-center gap-2 px-1">
                  <BrandLogo brandName={catalog.companyName} className="h-5 w-auto" />
                  <span className="font-mono-data text-[9px] uppercase tracking-wider text-muted">
                    {catalog.companyName}
                    {openSeries ? ` · ${openSeries.name}` : ""}
                  </span>
                </div>
              )}

              <div className="relative">
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t("catalogFilter")}
                  className="w-full rounded-sm border border-divider bg-white py-2 pl-7 pr-7 font-mono-data text-[10px] placeholder:text-muted/50"
                />
                <svg
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted/50"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
                  <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
                {filter && (
                  <button
                    type="button"
                    onClick={() => setFilter("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted"
                    aria-label={t("clearFilter")}
                  >
                    ×
                  </button>
                )}
              </div>

              {swatches.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">
                  {filter.trim()
                    ? t("catalogNoMatch")
                    : activeZonePalette === "wood"
                      ? t("noWoodColours")
                      : activeZonePalette === "tile"
                        ? t("noTileColours")
                        : t("noPaintColours")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {swatches.map((swatch) => {
                    const active = swatch.hex.toLowerCase() === selectedHex.toLowerCase();
                    return (
                      <ZrkCatalogCard
                        key={swatch.id}
                        hex={swatch.hex}
                        imageSrc={swatch.imageUrl}
                        thumbSrc={swatch.thumbUrl}
                        code={swatch.sheetCode}
                        title={swatch.name}
                        subtitle={swatch.materialCategory ?? paletteLabel}
                        meta={catalog?.companyName}
                        active={active}
                        onClick={() => onPick(swatch)}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
