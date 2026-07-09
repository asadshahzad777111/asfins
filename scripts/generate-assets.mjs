/**
 * Generates placeholder scene assets for kitchen-1.
 * Replace output files with real photography + masks (same dimensions).
 *
 * Run: npm run generate-assets
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public/scenes/kitchen-1");
const W = 1200;
const H = 800;

async function basePhoto() {
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e8e0d4"/>
          <stop offset="100%" stop-color="#d4ccc0"/>
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#c9c2b5"/>
          <stop offset="100%" stop-color="#b0a898"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="55%" fill="url(#wall)"/>
      <rect y="55%" width="100%" height="45%" fill="url(#floor)"/>
      <!-- upper cabinets -->
      <rect x="80" y="120" width="420" height="140" fill="#a08060" rx="4"/>
      <rect x="520" y="120" width="280" height="140" fill="#907050" rx="4"/>
      <!-- lower cabinets -->
      <rect x="80" y="380" width="420" height="200" fill="#8b6848" rx="4"/>
      <rect x="80" y="400" width="200" height="8" fill="#6b5038"/>
      <rect x="300" y="400" width="200" height="8" fill="#6b5038"/>
      <!-- island -->
      <rect x="480" y="480" width="320" height="120" fill="#9a7555" rx="6"/>
      <!-- shelves -->
      <rect x="900" y="200" width="180" height="24" fill="#b8956a"/>
      <rect x="900" y="280" width="180" height="24" fill="#b8956a"/>
      <rect x="900" y="360" width="180" height="24" fill="#b8956a"/>
      <!-- counter -->
      <rect x="80" y="360" width="420" height="20" fill="#d9d2c5"/>
      <rect x="480" y="460" width="320" height="20" fill="#e0d8cc"/>
      <text x="40" y="760" font-family="Georgia" font-size="14" fill="#6b6255">PLACEHOLDER — swap with real kitchen photo</text>
    </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(path.join(OUT, "base.jpg"));
}

function maskSvg(zone) {
  const shapes = {
    floor: `<rect y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="white"/>`,
    wall: `<rect width="${W}" height="${H * 0.55}" fill="white"/>`,
    cabinets: `
      <rect x="80" y="120" width="420" height="140" fill="#ddd" rx="4"/>
      <rect x="520" y="120" width="280" height="140" fill="#ccc" rx="4"/>
      <rect x="80" y="380" width="420" height="200" fill="#bbb" rx="4"/>
      <rect x="80" y="360" width="420" height="20" fill="#aaa"/>
    `,
    island: `<rect x="480" y="460" width="320" height="140" fill="#ccc" rx="6"/>`,
    shelves: `
      <rect x="900" y="200" width="180" height="24" fill="#ddd"/>
      <rect x="900" y="280" width="180" height="24" fill="#ccc"/>
      <rect x="900" y="360" width="180" height="24" fill="#bbb"/>
    `,
  };
  return `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="black"/>
      ${shapes[zone]}
    </svg>`;
}

async function writeMask(name, zone) {
  await sharp(Buffer.from(maskSvg(zone)))
    .png()
    .toFile(path.join(OUT, `mask-${name}.png`));
}

async function highlightMap() {
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="transparent"/>
      <ellipse cx="400" cy="300" rx="200" ry="80" fill="white" opacity="0.25"/>
      <ellipse cx="650" cy="520" rx="150" ry="50" fill="white" opacity="0.2"/>
      <line x1="100" y1="150" x2="500" y2="200" stroke="white" stroke-width="40" opacity="0.15"/>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, "highlight-gloss.png"));
}

async function nightGlow() {
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#ffb870" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="#ffb870" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <ellipse cx="300" cy="500" rx="120" ry="60" fill="#ffa040" opacity="0.35"/>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, "night-glow.png"));
}

await mkdir(OUT, { recursive: true });
console.log("Generating placeholder assets →", OUT);
await basePhoto();
await writeMask("floor", "floor");
await writeMask("wall", "wall");
await writeMask("cabinets", "cabinets");
await writeMask("island", "island");
await writeMask("shelves", "shelves");
await highlightMap();
await nightGlow();
console.log("Done. Swap these files with real photography when ready.");

// kitchen-real placeholder (single cabinet zone demo)
const REAL_OUT = path.join(__dirname, "../public/scenes/kitchen-real");
const RW = 1920;
const RH = 1280;

async function realKitchenBase() {
  const svg = `
    <svg width="${RW}" height="${RH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ece4d8"/>
          <stop offset="100%" stop-color="#d8d0c4"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#wall)"/>
      <rect x="120" y="280" width="1680" height="420" fill="#9a7555" rx="8"/>
      <rect x="120" y="720" width="1680" height="380" fill="#8b6848" rx="8"/>
      <rect x="120" y="700" width="1680" height="24" fill="#d9d2c5"/>
      <text x="60" y="${RH - 40}" font-family="Georgia" font-size="22" fill="#6b6255">REAL KITCHEN PLACEHOLDER — run npm run process-real-kitchen with your photos</text>
    </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(path.join(REAL_OUT, "base.jpg"));
}

async function realKitchenMask() {
  const svg = `
    <svg width="${RW}" height="${RH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="black"/>
      <rect x="120" y="280" width="1680" height="420" fill="#ccc" rx="8"/>
      <rect x="120" y="720" width="1680" height="380" fill="#bbb" rx="8"/>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(REAL_OUT, "mask-cabinets.png"));
}

async function realKitchenOverlays() {
  const highlight = Buffer.from(
    `<svg width="${RW}" height="${RH}"><ellipse cx="${RW * 0.5}" cy="${RH * 0.35}" rx="${RW * 0.25}" ry="${RH * 0.12}" fill="white" opacity="0.2"/></svg>`
  );
  await sharp(highlight).png().toFile(path.join(REAL_OUT, "highlight-gloss.png"));
  const glow = Buffer.from(
    `<svg width="${RW}" height="${RH}"><radialGradient id="g"><stop offset="0%" stop-color="#ffb870" stop-opacity="0.6"/><stop offset="100%" stop-color="#ffb870" stop-opacity="0"/></radialGradient><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
  await sharp(glow).png().toFile(path.join(REAL_OUT, "night-glow.png"));
}

await mkdir(REAL_OUT, { recursive: true });
console.log("Generating kitchen-real placeholder →", REAL_OUT);
await realKitchenBase();
await realKitchenMask();
await realKitchenOverlays();
console.log("kitchen-real demo assets ready.");
