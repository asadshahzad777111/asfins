"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SceneRenderer,
  defaultZoneColors,
  type FinishMode,
  type LightingMode,
  type ConfiguratorUpdate,
  type RenderState,
  type ZoneColors,
  type ZoneTextures,
  type ZoneFinishHints,
  type ColourBlock,
  type ZoneBoundingBox,
  type ZoneSplitState,
} from "@/lib/canvas/engine";
import type { SceneConfig } from "@/lib/scenes/types";
import type { CatalogSwatch } from "@/lib/catalogs/types";
import { finishHintFromSwatch } from "@/lib/catalogs/finish-hint";

interface UseConfiguratorOptions {
  onLoadError?: () => void;
}

export function useConfigurator(
  scene: SceneConfig,
  options?: UseConfiguratorOptions
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SceneRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<RenderState>(() => ({
    zoneColors: defaultZoneColors(scene.zones),
    zoneTextures: {},
    finish: "matt",
    lighting: "day",
    cabinetColourBoard: [],
    zoneSplits: {},
    zoneFinishHints: {},
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    setReady(false);
    setError(null);

    const initialColors = defaultZoneColors(scene.zones);
    const initialState: RenderState = {
      zoneColors: initialColors,
      zoneTextures: {},
      finish: "matt",
      lighting: "day",
      cabinetColourBoard: [],
      zoneSplits: {},
      zoneFinishHints: {},
    };
    setState(initialState);

    const renderer = new SceneRenderer(scene, canvas, initialState);
    rendererRef.current = renderer;

    renderer
      .init()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          options?.onLoadError?.();
        }
      });

    return () => {
      cancelled = true;
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  const update = useCallback((partial: ConfiguratorUpdate) => {
    setState((prev) => {
      const mergedColors: ZoneColors = { ...prev.zoneColors };
      if (partial.zoneColors) {
        for (const [key, val] of Object.entries(partial.zoneColors)) {
          if (val !== undefined) mergedColors[key] = val;
        }
      }
      const mergedTextures: ZoneTextures = { ...prev.zoneTextures };
      if (partial.zoneTextures) {
        for (const [key, val] of Object.entries(partial.zoneTextures)) {
          mergedTextures[key] = val;
        }
      }
      const mergedSplits = { ...prev.zoneSplits };
      if (partial.zoneSplits) {
        for (const [key, val] of Object.entries(partial.zoneSplits)) {
          if (val === undefined) delete mergedSplits[key];
          else mergedSplits[key] = val;
        }
      }
      const mergedHints: ZoneFinishHints = { ...prev.zoneFinishHints };
      if (partial.zoneFinishHints) {
        for (const [key, val] of Object.entries(partial.zoneFinishHints)) {
          mergedHints[key] = val;
        }
      }
      const next: RenderState = {
        finish: partial.finish ?? prev.finish,
        lighting: partial.lighting ?? prev.lighting,
        zoneColors: mergedColors,
        zoneTextures: mergedTextures,
        zoneSplits: mergedSplits,
        zoneFinishHints: mergedHints,
        cabinetColourBoard:
          partial.cabinetColourBoard !== undefined
            ? partial.cabinetColourBoard
            : prev.cabinetColourBoard,
      };
      rendererRef.current?.setState(partial);
      return next;
    });
  }, []);

  const setZoneColor = useCallback(
    async (
      zone: string,
      hex: string,
      imageUrl?: string,
      finishHint?: ReturnType<typeof finishHintFromSwatch>
    ) => {
      setApplying(true);
      try {
        let textureUrl = imageUrl;
        if (imageUrl) {
          try {
            await rendererRef.current?.preloadTexture(imageUrl);
          } catch {
            textureUrl = undefined;
          }
        }
        update({
          zoneColors: { [zone]: hex },
          zoneTextures: { [zone]: textureUrl },
          ...(finishHint ? { zoneFinishHints: { [zone]: finishHint } } : {}),
        });
      } finally {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setApplying(false));
        });
      }
    },
    [update]
  );

  const setZoneFromSwatch = useCallback(
    async (
      zone: string,
      swatch: Pick<
        CatalogSwatch,
        "hex" | "imageUrl" | "materialCategory" | "surfaceFinish" | "finishHint"
      >
    ) => {
      const hint = finishHintFromSwatch(swatch);
      await setZoneColor(zone, swatch.hex, swatch.imageUrl, hint);
    },
    [setZoneColor]
  );

  const setZoneColors = useCallback(
    (colors: Partial<ZoneColors>) => {
      update({ zoneColors: colors });
    },
    [update]
  );

  const setCabinetColourBoard = useCallback(
    (blocks: ColourBlock[]) => {
      setApplying(true);
      update({ cabinetColourBoard: blocks });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setApplying(false));
      });
    },
    [update]
  );

  /** Live-drag friendly — no `applying` overlay flash, intentionally synchronous per call. */
  const setZoneSplit = useCallback(
    (zone: string, split: ZoneSplitState | undefined) => {
      update({ zoneSplits: { [zone]: split } });
    },
    [update]
  );

  const getZoneBoundingBox = useCallback(
    (zone: string): ZoneBoundingBox | null => rendererRef.current?.getZoneBoundingBox(zone) ?? null,
    []
  );

  const setFinish = useCallback(
    (finish: FinishMode) => update({ finish }),
    [update]
  );

  const setLighting = useCallback(
    (lighting: LightingMode) => update({ lighting }),
    [update]
  );

  const exportPng = useCallback(() => {
    return rendererRef.current?.exportPng() ?? null;
  }, []);

  const resetColors = useCallback(() => {
    const defaults = defaultZoneColors(scene.zones);
    const clearedTextures: ZoneTextures = {};
    const clearedSplits: Record<string, undefined> = {};
    const clearedHints: ZoneFinishHints = {};
    for (const z of scene.zones) {
      clearedTextures[z.id] = undefined;
      clearedSplits[z.id] = undefined;
      clearedHints[z.id] = undefined;
    }
    update({
      zoneColors: defaults,
      zoneTextures: clearedTextures,
      cabinetColourBoard: [],
      zoneSplits: clearedSplits,
      zoneFinishHints: clearedHints,
    });
  }, [scene.zones, update]);

  return {
    canvasRef,
    ready,
    applying,
    error,
    state,
    setZoneColor,
    setZoneFromSwatch,
    setZoneColors,
    setCabinetColourBoard,
    setZoneSplit,
    getZoneBoundingBox,
    setFinish,
    setLighting,
    exportPng,
    resetColors,
  };
}
