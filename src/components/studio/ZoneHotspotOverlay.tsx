"use client";

import { useMemo } from "react";
import type { SceneConfig, SceneZoneConfig } from "@/lib/scenes/types";
import type { ZoneBoundingBox } from "@/lib/canvas/engine";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface ZoneHotspotOverlayProps {
  scene: SceneConfig;
  zones: SceneZoneConfig[];
  activeZone: string;
  ready: boolean;
  getZoneBoundingBox: (zoneId: string) => ZoneBoundingBox | null;
  onSelectZone: (zoneId: string) => void;
}

interface HotspotPos {
  zoneId: string;
  label: string;
  /** Percent of scene width */
  xPct: number;
  /** Percent of scene height */
  yPct: number;
}

/**
 * Tap dots over the live preview (Advanced options).
 * Positions come from mask bounding-box centres (engine getZoneBoundingBox).
 */
export function ZoneHotspotOverlay({
  scene,
  zones,
  activeZone,
  ready,
  getZoneBoundingBox,
  onSelectZone,
}: ZoneHotspotOverlayProps) {
  const { t } = useLanguage();

  const hotspots = useMemo(() => {
    if (!ready || zones.length === 0) return [] as HotspotPos[];
    const next: HotspotPos[] = [];
    for (const zone of zones) {
      const box = getZoneBoundingBox(zone.id);
      if (!box || box.w <= 0 || box.h <= 0) continue;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      next.push({
        zoneId: zone.id,
        label: zone.label,
        xPct: (cx / scene.width) * 100,
        yPct: (cy / scene.height) * 100,
      });
    }
    return next;
  }, [ready, zones, scene.width, scene.height, getZoneBoundingBox]);

  if (!ready || hotspots.length === 0) return null;

  return (
    <div className="zone-hotspot-overlay pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {hotspots.map((h) => {
        const active = h.zoneId === activeZone;
        return (
          <button
            key={h.zoneId}
            type="button"
            className={`zone-hotspot-dot pointer-events-auto absolute flex items-center justify-center ${
              active ? "zone-hotspot-dot--active" : ""
            }`}
            style={{
              left: `${h.xPct}%`,
              top: `${h.yPct}%`,
              transform: "translate(-50%, -50%)",
            }}
            aria-label={t("zoneHotspotSelect", { zone: h.label })}
            aria-pressed={active}
            onClick={(e) => {
              e.stopPropagation();
              onSelectZone(h.zoneId);
            }}
          >
            <span className="zone-hotspot-dot__core" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
