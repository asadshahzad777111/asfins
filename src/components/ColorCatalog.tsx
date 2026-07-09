"use client";

import { motion } from "framer-motion";
import { BrandLogo } from "@/components/BrandLogo";
import { SwatchThumb } from "@/components/SwatchThumb";
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
  const catalog = catalogs.find((c) => c.id === selectedCatalogId) ?? catalogs[0];
  const swatches: CatalogSwatch[] = (catalog?.swatches ?? []).filter(
    (s) => s.palette === activeZonePalette
  );
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

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg text-charcoal">{t(headingKey)}</p>
        <p className="mt-1 text-sm text-muted">{t(hintKey)}</p>
      </div>

      {catalogs.length > 1 && (
        <label className="block">
          <span className="font-mono-data text-[10px] uppercase tracking-wider text-muted">
            {t("companyCatalog")}
          </span>
          <select
            value={selectedCatalogId}
            onChange={(e) => onCatalogChange(e.target.value)}
            className="mt-1 w-full rounded-sm border border-divider bg-base px-3 py-2.5 text-sm"
          >
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
          {catalog && <CatalogCompanyLabel companyName={catalog.companyName} className="mt-2" />}
        </label>
      )}

      {catalog && catalogs.length === 1 && (
        <CatalogCompanyLabel companyName={catalog.companyName} />
      )}

      {swatches.length === 0 ? (
        <p className="text-sm text-muted">
          {activeZonePalette === "wood"
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
