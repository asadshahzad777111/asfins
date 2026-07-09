import { SHOP } from "./constants";
import { nameFromHex } from "./estimate";
import type { ZoneColors } from "./canvas/engine";
import type { SceneZoneConfig } from "./scenes/types";
import type { CatalogSwatch } from "./catalogs/types";

export function buildWhatsAppMessage(
  zoneColors: ZoneColors,
  zones: SceneZoneConfig[],
  swatches?: CatalogSwatch[]
): string {
  const parts = zones.map((z) => {
    const hex = zoneColors[z.id];
    const colorName = nameFromHex(hex, swatches);
    return `${z.label}: ${colorName}`;
  });
  return (
    `Hi, mujhe yeh design chahiye:\n` +
    parts.join("\n") +
    `\n— ${SHOP.name}, ${SHOP.city}`
  );
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
