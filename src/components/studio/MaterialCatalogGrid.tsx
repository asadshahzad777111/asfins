"use client";

import { useMemo, useState } from "react";
import { ZrkCatalogCard } from "@/components/ZrkCatalogCard";
import { BrandLogo } from "@/components/BrandLogo";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";
import type { ZonePalette } from "@/lib/scenes/types";

interface MaterialCatalogGridProps {
  catalogs: Catalog[];
  selectedCatalogId: string;
  onCatalogChange: (id: string) => void;
  activeZonePalette: ZonePalette;
  selectedHex: string;
  onPick: (swatch: CatalogSwatch) => void;
}

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

  const catalog = catalogs.find((c) => c.id === selectedCatalogId) ?? catalogs[0];
  const swatches: CatalogSwatch[] = useMemo(() => {
    const list = (catalog?.swatches ?? []).filter((s) => s.palette === activeZonePalette);
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.sheetCode.toLowerCase().includes(q)
    );
  }, [catalog, activeZonePalette, filter]);

  const paletteLabel =
    activeZonePalette === "wood"
      ? t("paletteWoodLaminate")
      : activeZonePalette === "tile"
        ? t("paletteTile")
        : t("palettePaint");

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 border-b border-divider bg-marble/95 px-4 py-3 backdrop-blur-sm">
        <p className="studio-panel-label">{t("selectMaterial")}</p>
        <p className="font-display mt-0.5 text-sm text-charcoal">{paletteLabel}</p>
      </div>

      <div className="space-y-3 p-3">
        {catalogs.length > 1 && (
          <select
            value={selectedCatalogId}
            onChange={(e) => onCatalogChange(e.target.value)}
            className="w-full rounded-sm border border-divider bg-white px-2.5 py-2 font-mono-data text-[10px]"
          >
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        )}

        {catalog && (
          <div className="flex items-center gap-2 px-1">
            <BrandLogo brandName={catalog.companyName} className="h-5 w-auto" />
            <span className="font-mono-data text-[9px] uppercase tracking-wider text-muted">
              {catalog.companyName}
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
            {activeZonePalette === "wood"
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
                  subtitle={paletteLabel}
                  meta={catalog?.companyName}
                  active={active}
                  onClick={() => onPick(swatch)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
