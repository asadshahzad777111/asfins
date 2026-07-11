/**
 * Scene asset persistence: local `public/scenes/` in dev, Cloudflare R2 on Vercel.
 * Vercel serverless (`/var/task`) is read-only — never mkdir/write under `public/` there.
 */

import { access, mkdir, readdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import {
  isR2Configured,
  missingR2EnvNames,
  r2PublicUrlForKey,
  requireR2Env,
  uploadBufferToR2,
  R2ConfigError,
} from "./r2";

export { R2ConfigError };

/** True on Vercel (production/preview) — must not write into `public/`. */
export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * Whether new scene asset URLs should point at R2.
 * - Vercel: always (requires R2 env)
 * - Local: only when R2 is configured AND SCENE_STORAGE=r2 (opt-in)
 */
export function shouldPersistScenesToR2(): boolean {
  if (isVercelRuntime()) return true;
  return process.env.SCENE_STORAGE === "r2" && isR2Configured();
}

/** Call before any scene write on Vercel so missing R2 env fails clearly (not ENOENT). */
export function assertSceneStorageReady(): void {
  if (!isVercelRuntime()) return;
  if (!isR2Configured()) {
    const missing = missingR2EnvNames();
    throw new R2ConfigError(
      `Cannot save scenes on Vercel: filesystem is read-only and R2 is not configured. Missing: ${missing.join(", ") || "R2_*"}. Add Cloudflare R2 env vars in Vercel, then redeploy.`
    );
  }
}

/** Writable work directory for mask/cutout processing. */
export function getSceneWorkDir(sceneId: string): string {
  if (shouldPersistScenesToR2()) {
    return path.join(os.tmpdir(), "asfins-scenes", sceneId);
  }
  return path.join(process.cwd(), "public", "scenes", sceneId);
}

/** Public URL prefix for scene assets (no trailing slash). */
export function sceneAssetBaseUrl(sceneId: string): string {
  if (shouldPersistScenesToR2()) {
    requireR2Env();
    return r2PublicUrlForKey(`scenes/${sceneId}`);
  }
  return `/scenes/${sceneId}`;
}

/** Sibling URL next to an existing asset (works for `/scenes/...` and full R2 URLs). */
export function siblingAssetUrl(assetUrl: string, filename: string): string {
  const dir = assetUrl.replace(/\/[^/]+$/, "");
  return `${dir}/${filename}`;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a file exists in the work dir: write buffer, keep local file, or download from URL.
 */
export async function ensureWorkFile(
  localPath: string,
  opts: { buffer?: Buffer | null; remoteUrl?: string | null; label?: string }
): Promise<void> {
  if (opts.buffer && opts.buffer.length > 0) {
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, opts.buffer);
    return;
  }
  if (await fileExists(localPath)) return;

  const url = opts.remoteUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    const res = await fetch(url, {
      headers: { "User-Agent": "ASFins-SceneStorage/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(
        `Could not download ${opts.label ?? path.basename(localPath)} (${res.status})`
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, buf);
    return;
  }

  // Relative /scenes/... — only available when baked into the deploy or local public/
  if (url && url.startsWith("/")) {
    const disk = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    if (await fileExists(disk)) {
      const buf = await readFile(disk);
      await mkdir(path.dirname(localPath), { recursive: true });
      await writeFile(localPath, buf);
      return;
    }
  }

  throw new Error(
    `${opts.label ?? path.basename(localPath)} is missing — re-upload it and try again`
  );
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkFiles(full)));
    else out.push(full);
  }
  return out;
}

/**
 * After processing in workDir: on R2 mode upload every file; locally workDir is already public/.
 * Returns the public asset base URL (no trailing slash).
 */
export async function persistSceneWorkDir(
  sceneId: string,
  workDir: string
): Promise<string> {
  if (!shouldPersistScenesToR2()) {
    return `/scenes/${sceneId}`;
  }

  requireR2Env();
  const files = await walkFiles(workDir);
  if (files.length === 0) {
    throw new Error("No scene files were produced to upload");
  }

  for (const full of files) {
    const rel = path.relative(workDir, full).replace(/\\/g, "/");
    const key = `scenes/${sceneId}/${rel}`;
    const body = await readFile(full);
    await uploadBufferToR2(key, body);
  }

  return sceneAssetBaseUrl(sceneId);
}
