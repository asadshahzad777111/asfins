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

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const CLICK_MOVE_THRESHOLD = 6;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function CutoutZoneMapper({
  basePreviewUrl,
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverRegion, setHoverRegion] = useState<number>(-1);
  const [scale, setScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [popover, setPopover] = useState<{ regionId: number; x: number; y: number } | null>(null);
  const pulseRef = useRef(0);

  const canPickZone = Boolean(onAssignRegionToZone && zoneOptions.length > 0);

  const unmappedIds = new Set(
    parsed.regions
      .filter((r) => !regionToZone[r.id])
      .map((r) => r.id)
  );

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
      const pulse = pulseRef.current;

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
        else alpha = 0.4 + pulse * 0.3; // unmapped — pulse so nothing gets missed
        if (rid === hoverRegion) alpha = Math.min(alpha + 0.25, 0.9);

        data[pi] = Math.round(data[pi] * (1 - alpha) + r * alpha);
        data[pi + 1] = Math.round(data[pi + 1] * (1 - alpha) + g * alpha);
        data[pi + 2] = Math.round(data[pi + 2] * (1 - alpha) + b * alpha);
      }

      ctx!.putImageData(overlay, 0, 0);

      for (const region of regions) {
        const assigned = regionToZone[region.id];

        if (!assigned) {
          // Marching-ants dashed outline — draws attention to anything still untagged.
          const b = region.bounds;
          ctx!.save();
          ctx!.setLineDash([7, 5]);
          ctx!.lineDashOffset = -pulse * 22;
          ctx!.strokeStyle = "#d97706";
          ctx!.lineWidth = 2;
          ctx!.strokeRect(b.minX + 1, b.minY + 1, b.maxX - b.minX - 2, b.maxY - b.minY - 2);
          ctx!.restore();
          continue;
        }

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

  // Pulse/marching-ants animation loop — only runs while something is untagged.
  useEffect(() => {
    if (unmappedIds.size === 0) return;
    let raf = 0;
    const tick = (t: number) => {
      pulseRef.current = (Math.sin(t / 420) + 1) / 2;
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [unmappedIds.size, draw]);

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

  // Reset pan/zoom whenever a new cutout is loaded — React's documented
  // "adjust state when a prop changes" pattern (state tracker, not a ref,
  // so it's safe to read/write during render).
  const [prevParsed, setPrevParsed] = useState(parsed);
  if (prevParsed !== parsed) {
    setPrevParsed(parsed);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const clampPan = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      if (nextZoom <= 1) return { x: 0, y: 0 };
      const canvas = canvasRef.current;
      const w = canvas ? canvas.clientWidth || parsed.width * scale : parsed.width * scale;
      const h = canvas ? canvas.clientHeight || parsed.height * scale : parsed.height * scale;
      const maxX = (w * (nextZoom - 1)) / (2 * nextZoom);
      const maxY = (h * (nextZoom - 1)) / (2 * nextZoom);
      return { x: clamp(nextPan.x, -maxX, maxX), y: clamp(nextPan.y, -maxY, maxY) };
    },
    [parsed.width, parsed.height, scale]
  );

  // Pointer-based pinch-zoom + pan + tap-to-select — mobile-friendly (touch-action:none avoids scroll hijack).
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    mode: "pan" | "pinch";
    startZoom: number;
    startPan: { x: number; y: number };
    startDist: number;
    startClient: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  const activateRegionAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * parsed.width;
      const y = ((clientY - rect.top) / rect.height) * parsed.height;
      const rid = regionAtPoint(parsed.regionMap, parsed.width, parsed.height, x, y);
      if (rid < 0) return;
      if (canPickZone) {
        setPopover({ regionId: rid, x: clientX, y: clientY });
      } else {
        onAssignRegion(rid);
      }
    },
    [parsed, canPickZone, onAssignRegion]
  );

  const onPointerDownWrap = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        mode: "pan",
        startZoom: zoom,
        startPan: pan,
        startDist: 0,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };
    } else if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      gestureRef.current = {
        mode: "pinch",
        startZoom: zoom,
        startPan: pan,
        startDist: distance(pts[0], pts[1]),
        startClient: { x: e.clientX, y: e.clientY },
        moved: true,
      };
    }
  }, [zoom, pan]);

  const onPointerMoveWrap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const gesture = gestureRef.current;
      if (!gesture) return;

      if (gesture.mode === "pinch" && pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()];
        const newDist = distance(pts[0], pts[1]);
        const factor = gesture.startDist > 0 ? newDist / gesture.startDist : 1;
        const nextZoom = clamp(gesture.startZoom * factor, MIN_ZOOM, MAX_ZOOM);
        setZoom(nextZoom);
        setPan((prev) => clampPan(nextZoom, prev));
        return;
      }

      if (gesture.mode === "pan") {
        const dx = e.clientX - gesture.startClient.x;
        const dy = e.clientY - gesture.startClient.y;
        if (Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) gesture.moved = true;
        if (gesture.moved && zoom > 1) {
          const nextPan = {
            x: gesture.startPan.x + dx / zoom,
            y: gesture.startPan.y + dy / zoom,
          };
          setPan(clampPan(zoom, nextPan));
        }
      }
    },
    [zoom, clampPan]
  );

  const onPointerUpWrap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      pointersRef.current.delete(e.pointerId);

      if (gesture?.mode === "pan" && !gesture.moved && pointersRef.current.size === 0) {
        activateRegionAt(e.clientX, e.clientY);
      }
      if (pointersRef.current.size === 0) {
        gestureRef.current = null;
      } else if (pointersRef.current.size === 1) {
        const [[, pt]] = pointersRef.current;
        gestureRef.current = {
          mode: "pan",
          startZoom: zoom,
          startPan: pan,
          startDist: 0,
          startClient: pt,
          moved: true,
        };
      }
    },
    [activateRegionAt, zoom, pan]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0016;
      const nextZoom = clamp(zoom * (1 + delta), MIN_ZOOM, MAX_ZOOM);
      setZoom(nextZoom);
      setPan((prev) => clampPan(nextZoom, prev));
    },
    [zoom, clampPan]
  );

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * parsed.width;
    const y = ((e.clientY - rect.top) / rect.height) * parsed.height;
    setHoverRegion(regionAtPoint(parsed.regionMap, parsed.width, parsed.height, x, y));
  }

  const assignedCount = Object.values(assignments).flat().length;
  const unmappedCount = unmappedIds.size;

  const popoverOptions = [{ id: "", label: t("wizardUnassigned") }, ...zoneOptions];

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
        <p className="wizard-mapper-zoom-hint">{t("wizardZoomHint")}</p>
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

      <div className="wizard-mapper-toolbar">
        <button
          type="button"
          className="wp-button wp-button--secondary wp-button--small"
          onClick={() => setZoom((z) => clamp(z - 0.5, MIN_ZOOM, MAX_ZOOM))}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="wizard-mapper-zoom-value">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="wp-button wp-button--secondary wp-button--small"
          onClick={() => setZoom((z) => clamp(z + 0.5, MIN_ZOOM, MAX_ZOOM))}
          aria-label="Zoom in"
        >
          +
        </button>
        {zoom > 1 && (
          <button type="button" className="wp-button wp-button--secondary wp-button--small" onClick={resetZoom}>
            {t("wizardResetZoom")}
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="wizard-mapper-canvas-wrap"
        onWheel={onWheel}
      >
        <div
          ref={wrapRef}
          onPointerDown={onPointerDownWrap}
          onPointerMove={onPointerMoveWrap}
          onPointerUp={onPointerUpWrap}
          onPointerCancel={onPointerUpWrap}
          style={{ touchAction: "none", cursor: zoom > 1 ? "grab" : "crosshair" }}
        >
          <canvas
            ref={canvasRef}
            className="wizard-mapper-canvas"
            style={{
              width: parsed.width * scale,
              height: parsed.height * scale,
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: "center center",
            }}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverRegion(-1)}
          />
        </div>
      </div>

      {popover && (
        <RegionPopover
          x={popover.x}
          y={popover.y}
          options={popoverOptions}
          onPick={(zoneId) => {
            onAssignRegionToZone?.(popover.regionId, zoneId);
            setPopover(null);
          }}
          onClose={() => setPopover(null)}
        />
      )}

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

/** Inline compact popover shown right at the clicked region — "what is this?" */
function RegionPopover({
  x,
  y,
  options,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  options: { id: string; label: string }[];
  onPick: (zoneId: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Keep on-screen: clamp near viewport edges.
  const left = clamp(x, 90, (typeof window !== "undefined" ? window.innerWidth : 800) - 90);
  const top = clamp(y, 60, (typeof window !== "undefined" ? window.innerHeight : 600) - 40);

  return (
    <div
      ref={ref}
      className="wizard-region-popover"
      style={{ left, top }}
    >
      <p className="wizard-region-popover-title">{t("wizardWhatIsThis")}</p>
      <div className="wizard-region-popover-options">
        {options.map((opt) => (
          <button
            key={opt.id || "unassigned"}
            type="button"
            className="wizard-region-popover-option"
            onClick={() => onPick(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
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
