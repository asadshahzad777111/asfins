/**
 * Append starter kitchen accessory SKUs to data/products.json (idempotent).
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "data", "products.json");

const ACCESSORIES = [
  {
    id: "acc-bar-handle-160",
    name: "Stainless Bar Handle 160mm",
    pricePKR: 450,
    image: "/products/placeholder.svg",
    category: "handles",
    description: "Brushed stainless steel bar handle — common kitchen cabinet fit.",
    active: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    productCode: "H-160-SS",
    brandName: "ASFins",
    stock: 120,
    lowStockAt: 20,
  },
  {
    id: "acc-cup-handle-96",
    name: "Cup Handle 96mm",
    pricePKR: 350,
    image: "/products/placeholder.svg",
    category: "handles",
    description: "Classic cup pull for drawers and lower cabinets.",
    active: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    productCode: "H-96-CUP",
    brandName: "ASFins",
    stock: 80,
    lowStockAt: 15,
  },
  {
    id: "acc-soft-close-hinge",
    name: "Soft-Close Cabinet Hinge",
    pricePKR: 280,
    image: "/products/placeholder.svg",
    category: "hardware",
    description: "Hydraulic soft-close hinge — pair pricing per piece.",
    active: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    productCode: "HW-HINGE-SC",
    brandName: "ASFins",
    stock: 200,
    lowStockAt: 40,
  },
  {
    id: "acc-drawer-channel-18",
    name: "Drawer Channel 18 inch",
    pricePKR: 650,
    image: "/products/placeholder.svg",
    category: "hardware",
    description: "Telescopic drawer runner set (pair) — 18 inch.",
    active: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    productCode: "HW-CH-18",
    brandName: "ASFins",
    stock: 60,
    lowStockAt: 10,
  },
  {
    id: "acc-cutlery-tray",
    name: "Cutlery Tray Organizer",
    pricePKR: 1800,
    image: "/products/placeholder.svg",
    category: "organizers",
    description: "Plastic cutlery organizer for standard drawer widths.",
    active: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    productCode: "ORG-CUTLERY",
    brandName: "ASFins",
    stock: 35,
    lowStockAt: 8,
  },
  {
    id: "acc-sink-single-bowl",
    name: "Single Bowl Kitchen Sink",
    pricePKR: 12500,
    image: "/products/placeholder.svg",
    category: "sinks",
    description: "Stainless single bowl sink — standard kitchen cutout.",
    active: true,
    createdAt: "2026-08-05T00:00:00.000Z",
    productCode: "SINK-SB-01",
    brandName: "ASFins",
    stock: 12,
    lowStockAt: 3,
  },
];

const raw = await readFile(registryPath, "utf-8");
const data = JSON.parse(raw);
const existing = new Set(data.products.map((p) => p.id));
let added = 0;
for (const item of ACCESSORIES) {
  if (existing.has(item.id)) continue;
  data.products.push(item);
  added += 1;
}
await writeFile(registryPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`Accessory seed: added ${added}, total products ${data.products.length}`);
