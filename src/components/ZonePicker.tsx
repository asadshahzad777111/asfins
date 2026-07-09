"use client";

import type { SceneZoneConfig, ZoneGroup } from "@/lib/scenes/types";
import { groupZones } from "@/lib/scenes/zones";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

interface ZonePickerProps {
  zones: SceneZoneConfig[];
  activeZone: string;
  onSelect: (zoneId: string) => void;
}

const GROUP_LABELS: Record<ZoneGroup, TranslationKey> = {
  wood: "zoneGroupWood",
  tile: "zoneGroupTile",
  surface: "zoneGroupSurface",
};

const GROUP_ORDER: ZoneGroup[] = ["wood", "tile", "surface"];

function paletteShortKey(palette: SceneZoneConfig["palette"]): TranslationKey {
  if (palette === "wood") return "paletteWoodShort";
  if (palette === "tile") return "paletteTile";
  return "palettePaint";
}

export function ZonePicker({ zones, activeZone, onSelect }: ZonePickerProps) {
  const { t } = useLanguage();
  const grouped = groupZones(zones);

  return (
    <div className="border-b border-divider bg-marble px-3 py-3 sm:px-4">
      <p className="font-mono-data mb-2 text-[10px] uppercase tracking-[0.2em] text-brass">
        {t("selectZone")}
      </p>

      {GROUP_ORDER.map((groupKey, groupIndex) => {
        const groupZonesList = grouped[groupKey];
        if (groupZonesList.length === 0) return null;

        return (
          <div key={groupKey} className={groupIndex > 0 ? "mt-3" : undefined}>
            <p className="font-mono-data mb-2 text-[10px] uppercase tracking-[0.2em] text-muted/70">
              {t(GROUP_LABELS[groupKey])}
            </p>
            <div className="flex flex-wrap gap-2">
              {groupZonesList.map((z) => {
                const active = z.id === activeZone;
                const muted = groupKey !== "wood";
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => onSelect(z.id)}
                    className={`rounded-sm px-3 py-2 text-xs transition-all ${
                      active
                        ? "bg-brass text-marble shadow-sm ring-1 ring-brass"
                        : muted
                          ? "border border-divider/60 bg-base/50 text-muted/70 hover:border-brass/30"
                          : "border border-divider bg-base text-muted hover:border-brass/50"
                    }`}
                  >
                    {z.label}
                    <span className="ml-1.5 font-mono-data text-[9px] opacity-70">
                      {t(paletteShortKey(z.palette))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
