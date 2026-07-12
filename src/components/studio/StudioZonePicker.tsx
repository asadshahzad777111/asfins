"use client";

import type { SceneZoneConfig, ZoneGroup } from "@/lib/scenes/types";
import { groupZones } from "@/lib/scenes/zones";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

interface StudioZonePickerProps {
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

export function StudioZonePicker({ zones, activeZone, onSelect }: StudioZonePickerProps) {
  const { t } = useLanguage();
  const grouped = groupZones(zones);

  return (
    <div className="border-b border-divider px-3 py-2.5">
      <p className="font-mono-data mb-2 text-[9px] uppercase tracking-[0.2em] text-muted">
        {t("selectZone")}
      </p>
      {GROUP_ORDER.map((groupKey) => {
        const groupZonesList = grouped[groupKey];
        if (groupZonesList.length === 0) return null;
        return (
          <div key={groupKey} className="mb-2 last:mb-0">
            <p className="font-mono-data mb-1.5 text-[8px] uppercase tracking-wider text-muted/60">
              {t(GROUP_LABELS[groupKey])}
            </p>
            <div className="flex flex-wrap gap-1">
              {groupZonesList.map((z) => {
                const active = z.id === activeZone;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => onSelect(z.id)}
                    className={`studio-chip px-2.5 py-1.5 font-mono-data text-[9px] uppercase tracking-wider transition-all ${
                      active
                        ? "studio-chip--active"
                        : "studio-chip--idle"
                    }`}
                  >
                    {z.label}
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
