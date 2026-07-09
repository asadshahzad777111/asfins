/**
 * Real kitchen scene — aapki photo + cabinet layer se.
 */
import type { SceneConfig } from "./types";

export type { ZoneId, SceneZoneConfig, SceneConfig } from "./types";

const ASSET_BASE = "/scenes/kitchen-real";

export const KITCHEN_REAL_SCENE: SceneConfig = {
  id: "kitchen-real",
  name: "Real Kitchen Photo",
  description: "Aapki kitchen photo — cabinet colour catalog se change karein",
  category: "kitchen",
  width: 768,
  height: 1024,
  basePhoto: `${ASSET_BASE}/base.jpg`,
  highlightMap: `${ASSET_BASE}/highlight-gloss.png`,
  nightGlow: `${ASSET_BASE}/night-glow.png`,
  zones: [
    {
      id: "cabinets",
      label: "Lower Cabinets (Almari)",
      maskPath: `${ASSET_BASE}/mask-cabinets.png`,
      palette: "wood",
      zIndex: 3,
      glossyHighlight: true,
    },
  ],
};

export { KITCHEN_SCENE, SCENES, getSceneById } from "./kitchen-1";
