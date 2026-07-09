/**
 * Create a test layer-cabinets.png (lower cabinets only, black bg)
 * for validating the mask pipeline when user layer is not yet uploaded.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "../public/scenes/kitchen-real");
const RW = 1920;
const RH = 1280;

// Lower cabinets only — matches generate-assets placeholder geometry
const svg = `
<svg width="${RW}" height="${RH}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#000000"/>
  <rect x="120" y="720" width="1680" height="380" fill="#8b6848" rx="8"/>
  <rect x="120" y="700" width="1680" height="24" fill="#d9d2c5"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(DIR, "layer-cabinets.png"));

console.log("Created layer-cabinets.png (lower cabinets on black bg)");
