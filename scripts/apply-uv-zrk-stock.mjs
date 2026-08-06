/**
 * Apply Zafar Plywood ZRK UV STOCK sheet (04/08/26) to UV Lux products.
 * Listed qty → stock; UV Lux codes not listed or qty 0 → out of stock (0).
 * Other series / accessories untouched.
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "data", "products.json");

/** productCode → balance from ZRK UV STOCK sheet */
const UV_STOCK = {
  4001: 36,
  4002: 95,
  4003: 29,
  4004: 19,
  4005: 7,
  4007: 54,
  4008: 0,
  4009: 35,
  4011: 14,
  4012: 63,
  4013: 22,
  4015: 6,
  4016: 21,
  4018: 31,
  4019: 18,
  4022: 22,
  5010: 0,
  5015: 36,
  5018: 4,
  5019: 3,
  5020: 1,
  5022: 39,
  5023: 26,
  5027: 2,
  5047: 0,
  5048: 14,
  5049: 43,
  5050: 17,
  5051: 18,
  5052: 0,
  5053: 14,
  5055: 31,
  5057: 4,
  6001: 2,
  6007: 26,
  6011: 63,
  6013: 5,
  6015: 24,
  6016: 20,
  6019: 1,
  6020: 0,
  6022: 0,
  6023: 11,
  6024: 30,
  6025: 10,
  6026: 17,
  6030: 33,
  6039: 19,
  6040: 19,
  6041: 18,
  6042: 7,
  786: 41,
  7017: 34,
  7018: 6,
  7021: 14,
  7025: 15,
  7026: 46,
  7029: 11,
  7032: 33,
  7033: 16,
  7035: 27,
  7042: 17,
  802: 11,
  8011: 0,
  8013: 43,
  8034: 25,
  8035: 17,
  8037: 8,
  8038: 31,
  8039: 29,
  8040: 43,
  8041: 85,
  8043: 0,
  8044: 0,
  8045: 22,
  8046: 24,
  8047: 21,
  8049: 52,
  8050: 22,
  8051: 0,
  8052: 48,
  8053: 19,
  8054: 20,
  8055: 12,
  8056: 31,
  8060: 25,
  8061: 10,
  8062: 34,
  8200: 54,
  8201: 12,
  8202: 21,
  8203: 10,
  8205: 21,
  8206: 40,
  8207: 15,
  8208: 38,
  8209: 5,
  8210: 25,
  8211: 59,
  8212: 14,
  8213: 25,
  8215: 10,
  8216: 30,
  8219: 33,
  8220: 0,
  8221: 47,
  8222: 100,
};

function isUvLux(p) {
  const blob = [p.materialCategory, p.surfaceFinish, p.description, p.finishHint]
    .filter(Boolean)
    .join(" ");
  return /uv\s*lux/i.test(blob) || p.finishHint === "uv-gloss";
}

const raw = await readFile(registryPath, "utf-8");
const data = JSON.parse(raw);

let matched = 0;
let zeroed = 0;
const missingCodes = [];
const updatedCodes = new Set();

for (const p of data.products) {
  if (!isUvLux(p)) continue;
  const code = String(p.productCode ?? "").trim();
  if (Object.prototype.hasOwnProperty.call(UV_STOCK, code)) {
    const qty = Number(UV_STOCK[code]) || 0;
    p.stock = qty;
    if (p.lowStockAt == null) p.lowStockAt = 10;
    matched += 1;
    updatedCodes.add(code);
  } else {
    p.stock = 0;
    zeroed += 1;
  }
}

for (const code of Object.keys(UV_STOCK)) {
  if (!updatedCodes.has(code)) missingCodes.push(code);
}

await writeFile(registryPath, JSON.stringify(data, null, 2) + "\n", "utf-8");

console.log(
  JSON.stringify(
    {
      uvMatchedFromSheet: matched,
      uvZeroedNotOnSheet: zeroed,
      sheetCodesMissingInCatalog: missingCodes,
    },
    null,
    2
  )
);
