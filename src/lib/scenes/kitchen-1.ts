/**
 * Scene asset config — swap in real photography + masks by changing paths only.
 * All images must share the same width × height as basePhoto.
 */

import type { SceneConfig, SceneZoneConfig, ZoneId } from "./types";

export type { SceneConfig, SceneZoneConfig, ZoneId };

const ASSET_BASE = "/scenes/kitchen-1";

export const KITCHEN_SCENE: SceneConfig = {
  id: "kitchen-1",
  name: "Modern L-Kitchen",
  description: "Upper + lower cabinets, island, floating shelves",
  category: "kitchen",
  width: 1200,
  height: 800,
  basePhoto: `${ASSET_BASE}/base.jpg`,
  highlightMap: `${ASSET_BASE}/highlight-gloss.png`,
  nightGlow: `${ASSET_BASE}/night-glow.png`,
  zones: [
    {
      id: "floor",
      label: "Floor",
      maskPath: `${ASSET_BASE}/mask-floor.png`,
      palette: "paint",
      zIndex: 1,
      glossyHighlight: false,
    },
    {
      id: "wall",
      label: "Wall",
      maskPath: `${ASSET_BASE}/mask-wall.png`,
      palette: "paint",
      zIndex: 2,
      glossyHighlight: false,
    },
    {
      id: "cabinets",
      label: "Main Cabinets",
      maskPath: `${ASSET_BASE}/mask-cabinets.png`,
      palette: "wood",
      zIndex: 3,
      glossyHighlight: true,
    },
    {
      id: "island",
      label: "Kitchen Island",
      maskPath: `${ASSET_BASE}/mask-island.png`,
      palette: "wood",
      zIndex: 4,
      glossyHighlight: true,
    },
    {
      id: "shelves",
      label: "Floating Shelves",
      maskPath: `${ASSET_BASE}/mask-shelves.png`,
      palette: "wood",
      zIndex: 5,
      glossyHighlight: true,
    },
  ],
};

export const SCENES = [KITCHEN_SCENE] as const;

export function getSceneById(id: string): SceneConfig | undefined {
  return SCENES.find((s) => s.id === id);
}
