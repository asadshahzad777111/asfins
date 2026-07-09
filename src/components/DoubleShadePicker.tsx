"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import { DOUBLE_SHADE_PRESETS } from "@/lib/scenes/zones";
import type { SceneZoneConfig } from "@/lib/scenes/types";
import type { ZoneColors } from "@/lib/canvas/engine";

interface DoubleShadePickerProps {
  zones: SceneZoneConfig[];
  zoneColors: ZoneColors;
  upperId?: string;
  lowerId?: string;
  onApply: (colors: Partial<ZoneColors>) => void;
}

export function DoubleShadePicker({
  zones,
  zoneColors,
  upperId,
  lowerId,
  onApply,
}: DoubleShadePickerProps) {
  const { t } = useLanguage();

  if (!upperId || !lowerId) return null;

  const upperZone = zones.find((z) => z.id === upperId);
  const lowerZone = zones.find((z) => z.id === lowerId);

  const activePresetId = DOUBLE_SHADE_PRESETS.find(
    (p) =>
      zoneColors[upperId]?.toLowerCase() === p.upperHex.toLowerCase() &&
      zoneColors[lowerId]?.toLowerCase() === p.lowerHex.toLowerCase()
  )?.id;

  return (
    <div className="rounded-sm border border-brass/30 bg-brass/5 p-4">
      <p className="font-display text-sm text-charcoal">{t("doubleShade")}</p>
      <p className="mt-1 text-xs text-muted">{t("doubleShadeHint")}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {DOUBLE_SHADE_PRESETS.map((preset) => {
          const active = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onApply({ [upperId]: preset.upperHex, [lowerId]: preset.lowerHex })
              }
              className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-xs transition-all ${
                active
                  ? "border-brass bg-brass/15 ring-1 ring-brass"
                  : "border-divider bg-marble hover:border-brass/50"
              }`}
            >
              <span className="flex -space-x-1">
                <span
                  className="h-5 w-5 rounded-full border border-divider"
                  style={{ backgroundColor: preset.lowerHex }}
                  aria-hidden
                />
                <span
                  className="h-5 w-5 rounded-full border border-divider"
                  style={{ backgroundColor: preset.upperHex }}
                  aria-hidden
                />
              </span>
              {t(preset.labelKey)}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted">
        {t("doubleShadeIndependent", {
          upper: upperZone?.label ?? "",
          lower: lowerZone?.label ?? "",
        })}
      </p>
    </div>
  );
}
