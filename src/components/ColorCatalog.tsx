"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { SwatchThumb } from "@/components/SwatchThumb";
import {
  BrandCatalogFolders,
  catalogsToFolders,
} from "@/components/BrandCatalogFolders";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";
import type { ZonePalette } from "@/lib/scenes/types";

interface ColorCatalogProps {
  catalogs: Catalog[];
  selectedCatalogId: string;
  onCatalogChange: (id: string) => void;
  activeZonePalette: ZonePalette;
  selectedHex: string;
  onPick: (swatch: CatalogSwatch) => void;
}

export function ColorCatalog({
  catalogs,
  selectedCatalogId,
  onCatalogChange,
  activeZonePalette,
  selectedHex,
  onPick,
}: ColorCatalogProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("");
  const [browsingFolders, setBrowsingFolders] = useState(catalogs.length > 1);

  const folders = useMemo(() => catalogsToFolders(catalogs), [catalogs]);
  const catalog = catalogs.find((c) => c.id === selectedCatalogId) ?? catalogs[0];
  const swatches: CatalogSwatch[] = useMemo(() => {
    const list = (catalog?.swatches ?? []).filter((s) => s.palette === activeZonePalette);
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    const qDigits = q.replace(/\D/g, "");
    const scored = list
      .map((s) => {
        const code = s.sheetCode.toLowerCase();
        const name = s.name.toLowerCase();
        const codeDigits = code.replace(/\D/g, "");
        let score = 0;
        if (code === q || codeDigits === q || (qDigits && codeDigits === qDigits)) score = 3;
        else if (code.startsWith(q) || (qDigits && codeDigits.startsWith(qDigits))) score = 2;
        else if (code.includes(q) || name.includes(q) || (qDigits && codeDigits.includes(qDigits)))
          score = 1;
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.sheetCode.localeCompare(b.s.sheetCode));
    return scored.map((x) => x.s);
  }, [catalog, activeZonePalette, filter]);
  const headingKey =
    activeZonePalette === "wood"
      ? "chooseWoodColour"
      : activeZonePalette === "tile"
        ? "chooseTileColour"
        : "choosePaintColour";
  const hintKey =
    activeZonePalette === "wood"
      ? "catalogHintWood"
      : activeZonePalette === "tile"
        ? "catalogHintTile"
        : "catalogHintPaint";

  const showFolders = browsingFolders && folders.length > 1 && !filter.trim();

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg text-charcoal">{t(headingKey)}</p>
        <p className="mt-1 text-sm text-muted">{t(hintKey)}</p>
      </div>

      {showFolders ? (
        <div className="space-y-2">
          <p className="font-mono-data text-[10px] uppercase tracking-wider text-muted">
            {t("chooseBrandFolder")}
          </p>
          <BrandCatalogFolders
            folders={folders}
            onOpen={(id) => {
              onCatalogChange(id);
              setBrowsingFolders(false);
              setFilter("");
            }}
          />
        </div>
      ) : (
        <>
          {folders.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setBrowsingFolders(true);
                setFilter("");
              }}
              className="font-mono-data text-[10px] uppercase tracking-wider text-brass hover:underline"
            >
              {t("allBrandFolders")}
            </button>
          )}

          {catalog && <CatalogCompanyLabel companyName={catalog.companyName} />}

          <div className="relative">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("catalogFilter")}
              className="w-full rounded-sm border border-divider bg-base py-2.5 pl-8 pr-8 font-mono-data text-xs placeholder:text-muted/50"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted/50"
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted"
                aria-label={t("clearFilter")}
              >
                ×
              </button>
            )}
          </div>

          {swatches.length === 0 ? (
            <p className="text-sm text-muted">
              {filter.trim()
                ? t("catalogNoMatch")
                : activeZonePalette === "wood"
                  ? t("noWoodColours")
                  : activeZonePalette === "tile"
                    ? t("noTileColours")
                    : t("noPaintColours")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              {swatches.map((swatch) => {
                const active = swatch.hex.toLowerCase() === selectedHex.toLowerCase();
                return (
                  <motion.button
                    key={swatch.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onPick(swatch)}
                    className={`flex items-center gap-3 rounded-sm border p-3 text-left transition-all ${
                      active
                        ? "border-brass bg-brass/10 ring-2 ring-brass"
                        : "border-divider bg-marble hover:border-brass/50 hover:shadow-sm"
                    }`}
                  >
                    <SwatchThumb
                      hex={swatch.hex}
                      imageUrl={swatch.imageUrl}
                      thumbUrl={swatch.thumbUrl}
                      name={swatch.name}
                      className="h-14 w-14 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-medium text-charcoal">{swatch.name}</p>
                      <p className="font-mono-data text-[10px] text-muted">{swatch.sheetCode}</p>
                      {active && (
                        <p className="font-mono-data mt-0.5 text-[10px] text-brass">
                          {t("selected")}
                        </p>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CatalogCompanyLabel({
  companyName,
  className = "",
}: {
  companyName: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <BrandLogo brandName={companyName} className="h-6 w-auto" />
      <p className="font-mono-data text-xs uppercase tracking-wider text-brass">{companyName}</p>
    </div>
  );
}
