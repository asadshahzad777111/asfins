import { writeFile, readFile } from "fs/promises";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev";

function rewrite(u) {
  if (!u || typeof u !== "string") return u;
  if (u.startsWith("/catalog-textures/")) return `${PUBLIC}${u}`;
  if (u.includes("pub-901502176f964fd18fa9e875b6346c6f.r2.dev")) return u;
  return u;
}

// Restore from last good commit (before bad R2 rewrite)
const catalogsRaw = execSync("git show 95da0dd:data/catalogs.json", {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});
const productsRaw = execSync("git show 95da0dd:data/products.json", {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});

const catalogs = JSON.parse(catalogsRaw);
const products = JSON.parse(productsRaw);

let sw = 0;
for (const cat of catalogs.catalogs ?? []) {
  for (const s of cat.swatches ?? []) {
    s.imageUrl = rewrite(s.imageUrl);
    s.thumbUrl = rewrite(s.thumbUrl);
    sw++;
  }
}
for (const p of products.products ?? []) {
  p.image = rewrite(p.image);
}

await writeFile(
  path.join(ROOT, "data/catalogs.json"),
  JSON.stringify(catalogs, null, 2) + "\n"
);
await writeFile(
  path.join(ROOT, "data/products.json"),
  JSON.stringify(products, null, 2) + "\n"
);

const z = catalogs.catalogs.find((c) => c.id === "zrk-group");
console.log("swatches total", sw);
console.log("zrk", z?.swatches?.length, z?.swatches?.[0]?.thumbUrl);
console.log("products", products.products.length);
