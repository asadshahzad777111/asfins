"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRegionColor,
  regionAtPoint,
  type ParsedCutout,
  type ParsedRegion,
} from "@/lib/images/region-labeler";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CutoutZoneMapperProps {
  basePreviewUrl: string | null;
  cutoutPreviewUrl: string;
  parsed: ParsedCutout;
  assignments: Record<string, number[]>;
  regionToZone: Record<number, string>;
  currentZoneId: string;
  currentZoneLabel: string;
  onAssignRegion: (regionId: number) => void;
  zoneOptions?: { id: string; label: string }[];
  onAssignRegionToZone?: (regionId: number, zoneId: string) => void;
  /** Show region dropdown list above the canvas (region-first labeling). */
  regionListFirst?: boolean;
}

export function CutoutZoneMapper({
  basePreviewUrl,
  cutoutPreviewUrl,
  parsed,
  assignments,
  regionToZone,
  currentZoneId,
  currentZoneLabel,
  onAssignRegion,
  zoneOptions = [],
  onAssignRegionToZone,
  regionListFirst = false,
}: CutoutZoneMapperProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverRegion, setHoverRegion] = useState<number>(-1);
  const [scale, setScale] = useState(1);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, regionMap, regions } = parsed;
    canvas.width = width;
    canvas.height = height;

    function drawOverlays() {
      const overlay = ctx!.getImageData(0, 0, width, height);
      const data = overlay.data;

      for (let i = 0; i < width * height; i++) {
        const rid = regionMap[i];
        if (rid < 0) continue;

        const pi = i * 4;
        const color = getRegionColor(rid);
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const assignedZone = regionToZone[rid];
        let alpha = 0.35;
        if (assignedZone === currentZoneId) alpha = 0.65;
        else if (assignedZone) alpha = 0.25;
        else alpha = 0.55; // unmapped — stand out for labeling
        if (rid === hoverRegion) alpha = Math.min(alpha + 0.25, 0.85);

        data[pi] = Math.round(data[pi] * (1 - alpha) + r * alpha);
        data[pi + 1] = Math.round(data[pi + 1] * (1 - alpha) + g * alpha);
        data[pi + 2] = Math.round(data[pi + 2] * (1 - alpha) + b * alpha);
      }

      ctx!.putImageData(overlay, 0, 0);

      for (const region of regions) {
        const assigned = regionToZone[region.id];
        if (!assigned) continue;
        ctx!.beginPath();
        ctx!.arc(region.centroid.x, region.centroid.y, 6, 0, Math.PI * 2);
        ctx!.fillStyle = assigned === currentZoneId ? "#2271b1" : "#50575e";
        ctx!.fill();
        ctx!.strokeStyle = "#fff";
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }
    }

    if (basePreviewUrl) {
      const baseImg = new Image();
      baseImg.src = basePreviewUrl;
      baseImg.onload = () => {
        ctx.drawImage(baseImg, 0, 0, width, height);
        drawOverlays();
      };
      if (baseImg.complete) {
        ctx.drawImage(baseImg, 0, 0, width, height);
        drawOverlays();
      }
    } else {
      ctx.fillStyle = "#e8e4dc";
      ctx.fillRect(0, 0, width, height);
      drawOverlays();
    }
  }, [parsed, basePreviewUrl, regionToZone, currentZoneId, hoverRegion]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      if (!container) return;
      const maxW = container.clientWidth;
      setScale(Math.min(1, maxW / parsed.width));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [parsed.width]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * parsed.width;
    const y = ((e.clientY - rect.top) / rect.height) * parsed.height;
    const rid = regionAtPoint(parsed.regionMap, parsed.width, parsed.height, x, y);
    if (rid >= 0) onAssignRegion(rid);
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * parsed.width;
    const y = ((e.clientY - rect.top) / rect.height) * parsed.height;
    setHoverRegion(regionAtPoint(parsed.regionMap, parsed.width, parsed.height, x, y));
  }

  const assignedCount = Object.values(assignments).flat().length;
  const unmappedCount = parsed.regions.length - new Set(Object.values(assignments).flat()).size;

  return (
    <div className="wizard-mapper">
      <div className="wizard-mapper-head">
        <p className="wizard-mapper-zone">
          {t("wizardClickToMark")}: <strong>{currentZoneLabel}</strong>
        </p>
        <p className="wizard-mapper-stats">
          {t("wizardRegionsFound", { count: parsed.regions.length })} ·{" "}
          {t("wizardRegionsMapped", { mapped: assignedCount, total: parsed.regions.length })}
          {unmappedCount > 0 && (
            <span className="wizard-mapper-warn"> · {t("wizardUnmapped", { count: unmappedCount })}</span>
          )}
        </p>
      </div>

      {regionListFirst && (
        <RegionLegend
          regions={parsed.regions}
          regionToZone={regionToZone}
          currentZoneId={currentZoneId}
          zoneOptions={zoneOptions}
          onAssignRegionToZone={onAssignRegionToZone}
        />
      )}

      <div ref={containerRef} className="wizard-mapper-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="wizard-mapper-canvas"
          style={{
            width: parsed.width * scale,
            height: parsed.height * scale,
            cursor: "crosshair",
          }}
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverRegion(-1)}
        />
      </div>

      {!regionListFirst && (
        <RegionLegend
          regions={parsed.regions}
          regionToZone={regionToZone}
          currentZoneId={currentZoneId}
          zoneOptions={zoneOptions}
          onAssignRegionToZone={onAssignRegionToZone}
        />
      )}
    </div>
  );
}

function RegionLegend({
  regions,
  regionToZone,
  currentZoneId,
  zoneOptions,
  onAssignRegionToZone,
}: {
  regions: ParsedRegion[];
  regionToZone: Record<number, string>;
  currentZoneId: string;
  zoneOptions: { id: string; label: string }[];
  onAssignRegionToZone?: (regionId: number, zoneId: string) => void;
}) {
  const { t } = useLanguage();
  if (regions.length === 0) return null;

  return (
    <div className="wizard-region-legend">
      <p className="wp-menu-heading" style={{ padding: 0, marginBottom: "0.35rem" }}>
        {t("wizardRegionLegend")}
      </p>
      <div className="wizard-region-legend-items">
        {regions.map((r) => {
          const zone = regionToZone[r.id];
          const isCurrent = zone === currentZoneId;
          return (
            <span
              key={r.id}
              className={`wizard-region-chip${isCurrent ? " is-current" : ""}${!zone ? " is-unmapped" : ""}`}
            >
              <span
                className="wizard-region-swatch"
                style={{ background: getRegionColor(r.id) }}
              />
              #{r.id + 1}
              {onAssignRegionToZone && zoneOptions.length > 0 ? (
                <select
                  className="wizard-region-select"
                  value={zone ?? ""}
                  onChange={(e) => onAssignRegionToZone(r.id, e.target.value)}
                  aria-label={`${t("wizardRegionAssign")} #${r.id + 1}`}
                >
                  <option value="">{t("wizardUnassigned")}</option>
                  {zoneOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : zone ? (
                ` → ${zone}`
              ) : (
                ` (${t("wizardUnassigned")})`
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
