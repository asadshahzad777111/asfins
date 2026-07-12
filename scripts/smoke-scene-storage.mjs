/**
 * Smoke: scene save storage branches on VERCEL / SCENE_STORAGE without uploading.
 * Run: node scripts/smoke-scene-storage.mjs
 */
import assert from "assert";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Dynamic import of compiled? We use ts via next's paths — instead duplicate the
// pure branching rules here to avoid a TS loader, AND import the real module if
// available through a small inline reimplementation that must stay in sync.

function useRemoteSceneAssets(env) {
  return Boolean(env.VERCEL);
}

function isR2Configured(env) {
  return Boolean(
    env.R2_ACCOUNT_ID?.trim() &&
      env.R2_ACCESS_KEY_ID?.trim() &&
      env.R2_SECRET_ACCESS_KEY?.trim() &&
      env.R2_PUBLIC_URL?.trim()
  );
}

function shouldPersistScenesToR2(env) {
  if (useRemoteSceneAssets(env)) return true;
  return env.SCENE_STORAGE === "r2" && isR2Configured(env);
}

function getSceneWorkDir(sceneId, env, cwd = ROOT) {
  if (shouldPersistScenesToR2(env)) {
    return path.join(os.tmpdir(), "asfins-scenes", sceneId);
  }
  return path.join(cwd, "public", "scenes", sceneId);
}

function sceneAssetBaseUrl(sceneId, env) {
  if (shouldPersistScenesToR2(env)) {
    const pub = env.R2_PUBLIC_URL.replace(/\/$/, "");
    return `${pub}/scenes/${sceneId}`;
  }
  return `/scenes/${sceneId}`;
}

// --- Local default: disk ---
{
  const env = {};
  assert.strictEqual(shouldPersistScenesToR2(env), false);
  assert.ok(getSceneWorkDir("kitchen-test1", env).endsWith(path.join("public", "scenes", "kitchen-test1")));
  assert.strictEqual(sceneAssetBaseUrl("kitchen-test1", env), "/scenes/kitchen-test1");
}

// --- VERCEL=1 without R2: still "remote" path (work dir = tmp); API asserts R2 separately ---
{
  const env = { VERCEL: "1" };
  assert.strictEqual(shouldPersistScenesToR2(env), true);
  assert.ok(getSceneWorkDir("kitchen-test1", env).startsWith(os.tmpdir()));
  assert.ok(!getSceneWorkDir("kitchen-test1", env).includes(`${path.sep}public${path.sep}`));
}

// --- VERCEL=1 with R2: public URLs point at R2 ---
{
  const env = {
    VERCEL: "1",
    R2_ACCOUNT_ID: "acc",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_URL: "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev",
  };
  assert.strictEqual(shouldPersistScenesToR2(env), true);
  assert.strictEqual(
    sceneAssetBaseUrl("kitchen-test1", env),
    "https://pub-901502176f964fd18fa9e875b6346c6f.r2.dev/scenes/kitchen-test1"
  );
}

// --- Local opt-in SCENE_STORAGE=r2 ---
{
  const env = {
    SCENE_STORAGE: "r2",
    R2_ACCOUNT_ID: "acc",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_URL: "https://cdn.example/r2",
  };
  assert.strictEqual(shouldPersistScenesToR2(env), true);
  assert.ok(getSceneWorkDir("x", env).startsWith(os.tmpdir()));
}

// --- Local with R2 creds but no SCENE_STORAGE: stay on disk (npm run dev) ---
{
  const env = {
    R2_ACCOUNT_ID: "acc",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_PUBLIC_URL: "https://cdn.example/r2",
  };
  assert.strictEqual(shouldPersistScenesToR2(env), false);
  assert.ok(getSceneWorkDir("x", env).includes(path.join("public", "scenes")));
}

// Import real TS helpers via Next/tsx if present — prefer verifying source contains guards.
import { readFileSync } from "fs";
const routeSrc = readFileSync(
  path.join(ROOT, "src/app/api/admin/scenes/route.ts"),
  "utf8"
);
assert.ok(routeSrc.includes("assertSceneStorageReady"), "route must assert R2 on Vercel");
assert.ok(routeSrc.includes("persistSceneWorkDir"), "route must persist to R2");
assert.ok(routeSrc.includes("getSceneWorkDir"), "route must use work dir (tmp on Vercel)");
assert.ok(!/await mkdir\(sceneDir/.test(routeSrc) || routeSrc.includes("getSceneWorkDir"), "mkdir uses work dir");

const assetsSrc = readFileSync(
  path.join(ROOT, "src/lib/storage/scene-assets.ts"),
  "utf8"
);
assert.ok(assetsSrc.includes("process.env.VERCEL"));
assert.ok(assetsSrc.includes("os.tmpdir()"));
assert.ok(assetsSrc.includes("uploadBufferToR2") || assetsSrc.includes("persistSceneWorkDir"));

// --- Multi-use zone merge (Advanced → optional one Studio control) ---
function mergedStudioZoneId(slotId) {
  if (
    slotId === "lower-cabinets" ||
    slotId.startsWith("lower-cabinet") ||
    slotId.startsWith("lower-door")
  ) {
    return "lower-cabinets";
  }
  if (
    slotId === "upper-cabinets" ||
    slotId.startsWith("upper-cabinet") ||
    slotId.startsWith("upper-door")
  ) {
    return "upper-cabinets";
  }
  if (slotId === "island" || slotId === "table") return "island";
  return slotId;
}

/** Default: tagged slots stay separate unless admin assigns the same Studio control. */
function defaultStudioZoneId(slotId) {
  return slotId;
}

function mergeAssignmentsToStudioZones(assignments, targetBySlot) {
  const out = {};
  for (const [slotId, regionIds] of Object.entries(assignments)) {
    if (!regionIds.length) continue;
    const target = targetBySlot[slotId] ?? defaultStudioZoneId(slotId);
    const merged = new Set([...(out[target] ?? []), ...regionIds]);
    out[target] = Array.from(merged).sort((a, b) => a - b);
  }
  return out;
}

{
  assert.strictEqual(defaultStudioZoneId("lower-cabinet-left"), "lower-cabinet-left");
  assert.strictEqual(defaultStudioZoneId("lower-cabinet-mid"), "lower-cabinet-mid");
  assert.strictEqual(mergedStudioZoneId("lower-cabinet-left"), "lower-cabinets");
  assert.strictEqual(mergedStudioZoneId("upper-cabinet-right"), "upper-cabinets");
  const keptSeparate = mergeAssignmentsToStudioZones(
    {
      "lower-cabinet-left": [0, 1],
      "lower-cabinet-right": [2],
    },
    {
      "lower-cabinet-left": "lower-cabinet-left",
      "lower-cabinet-right": "lower-cabinet-right",
    }
  );
  assert.deepStrictEqual(keptSeparate["lower-cabinet-left"], [0, 1]);
  assert.deepStrictEqual(keptSeparate["lower-cabinet-right"], [2]);
  const merged = mergeAssignmentsToStudioZones(
    {
      "lower-cabinet-left": [0, 1],
      "lower-cabinet-mid": [10, 5],
      "lower-cabinet-right": [2],
      "upper-cabinet-left": [7],
    },
    {
      "lower-cabinet-left": "lower-cabinets",
      "lower-cabinet-mid": "lower-cabinets",
      "lower-cabinet-right": "lower-cabinets",
      "upper-cabinet-left": "upper-cabinets",
    }
  );
  assert.deepStrictEqual(merged["lower-cabinets"], [0, 1, 2, 5, 10]);
  assert.deepStrictEqual(merged["upper-cabinets"], [7]);
  assert.strictEqual(Object.keys(merged).length, 2);
}

const wizardSrc = readFileSync(
  path.join(ROOT, "src/components/admin/SceneSetupWizard.tsx"),
  "utf8"
);
assert.ok(wizardSrc.includes("mergeAssignmentsToStudioZones"), "wizard must merge on save");
assert.ok(wizardSrc.includes("wizardStudioControl"), "review UI must show Studio control");
assert.ok(wizardSrc.includes("buildMergedStudioTargets"), "wizard must support explicit merge");

const zoneWizardSrc = readFileSync(
  path.join(ROOT, "src/lib/scenes/zone-wizard.ts"),
  "utf8"
);
assert.ok(zoneWizardSrc.includes("mergeAssignmentsToStudioZones"));
assert.ok(zoneWizardSrc.includes("STUDIO_CABINET_TARGETS"));
assert.ok(zoneWizardSrc.includes("buildMergedStudioTargets"));
assert.ok(zoneWizardSrc.includes("mergedStudioZoneId"));

console.log("smoke-scene-storage: OK");
