"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SceneConfig } from "@/lib/scenes/types";
import {
  drawCabinetZoneOverlay,
  findCabinetZoneAt,
  snapshotMask,
  type MaskSnapshot,
} from "@/lib/canvas/zone-overlay";
import { sceneHasCabinetClickZones } from "@/lib/canvas/cabinet-zones";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CabinetZoneOverlayProps {
  scene: SceneConfig;
  activeZone: string;
  showLines: boolean;
  enabled: boolean;
  onSelectZone: (zoneId: string) => void;
}

export function CabinetZoneOverlay({
  scene,
  activeZone,
  showLines,
  enabled,
  onSelectZone,
}: CabinetZoneOverlayProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<MaskSnapshot[]>([]);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const dashRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    async function load() {
      const loaded: MaskSnapshot[] = [];
      await Promise.all(
        scene.zones.map(async (zone) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.referrerPolicy = "no-referrer";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(zone.maskPath));
            img.src = zone.maskPath;
          });
          const snap = snapshotMask(img, zone);
          if (snap) loaded.push(snap);
        })
      );
      if (!cancelled) {
        setSnapshots(loaded);
        setReady(true);
      }
    }

    void load().catch(() => {
      if (!cancelled) setReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, [scene.id, scene.zones]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCabinetZoneOverlay(ctx, snapshots, {
      activeZoneId: activeZone,
      hoverZoneId: hoverZone,
      showLines,
      dashOffset: dashRef.current,
    });
  }, [activeZone, enabled, hoverZone, ready, showLines, snapshots]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    if (!enabled || !showLines) return;
    let running = true;
    function tick() {
      if (!running) return;
      dashRef.current = (dashRef.current + 0.4) % 100;
      paint();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, showLines, paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerEl = container;
    const canvasEl = canvas;

    function syncSize() {
      const rect = containerEl.getBoundingClientRect();
      canvasEl.style.width = `${rect.width}px`;
      canvasEl.style.height = `${rect.height}px`;
      canvasEl.width = scene.width;
      canvasEl.height = scene.height;
      paint();
    }

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [scene.width, scene.height, paint]);

  function sceneCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * scene.width,
      y: ((e.clientY - rect.top) / rect.height) * scene.height,
    };
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!enabled || !ready) return;
    const { x, y } = sceneCoords(e);
    const zoneId = findCabinetZoneAt(snapshots, scene.zones, x, y);
    if (zoneId) onSelectZone(zoneId);
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!enabled || !ready) return;
    const { x, y } = sceneCoords(e);
    setHoverZone(findCabinetZoneAt(snapshots, scene.zones, x, y));
  }

  if (!sceneHasCabinetClickZones(scene.zones)) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${
          enabled ? "pointer-events-auto cursor-crosshair" : ""
        }`}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverZone(null)}
        aria-label={t("cabinetOverlayHint")}
      />
    </div>
  );
}
