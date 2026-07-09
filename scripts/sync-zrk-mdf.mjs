/**
 * Incremental ZRK sync — only new products on zrkgroup.com.
 * For daily auto-run via Task Scheduler / cron.
 *
 * Usage:
 *   npm run sync-zrk
 *   npm run sync-zrk:full
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { collectAllProductPaths, scrapeDetails } from "./lib/zrk-scraper-cli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const args = new Set(process.argv.slice(2));
const mirrorAll = args.has("--mirror-all");

async function runNode(script, scriptArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [script, ...scriptArgs], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))
    );
  });
}

const catalogsData = JSON.parse(
  await readFile(path.join(ROOT, "data/catalogs.json"), "utf8")
);
const catalog = catalogsData.catalogs.find((c) => c.id === "zrk-group");
const existing = new Set(catalog?.swatches?.map((s) => s.sheetCode) ?? []);

console.log("ZRK incremental sync\n");
console.log(`Local catalog: ${existing.size} products\n`);

const paths = await collectAllProductPaths();
const newPaths = paths.filter((p) => !existing.has(p.split("/").pop()));
console.log(`ZRK site: ${paths.length} total, ${newPaths.length} new\n`);

if (newPaths.length === 0) {
  console.log("Up to date — koi naya product nahi.");
} else {
  const { rows, errors } = await scrapeDetails(newPaths);
  const importPath = path.join(ROOT, "data/zrk-sync-new.json");
  await writeFile(importPath, JSON.stringify(rows, null, 2) + "\n");
  console.log(`\nImporting ${rows.length} new products...`);
  await runNode("scripts/import-zrk-batch.mjs", [importPath]);
  if (errors.length) console.log("Errors:", errors.slice(0, 5).join("; "));
}

if (mirrorAll || newPaths.length > 0) {
  console.log("\nMirroring images locally for fast loading...");
  await runNode("scripts/mirror-zrk-textures.mjs");
}

console.log("\nSync complete.");
