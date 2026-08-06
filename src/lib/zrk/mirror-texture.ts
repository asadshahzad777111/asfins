import { mkdir, access } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { writeDemirroredThumb } from "@/lib/zrk/demirror-texture";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public/catalog-textures/zrk");
const THUMB_DIR = path.join(OUT_DIR, "thumbs");

export interface MirroredTexture {
  code: string;
  thumbUrl: string;
  imageUrl: string;
  remoteUrl: string;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export function isRemoteZrkUrl(url?: string): boolean {
  return !!url && /^https?:\/\/strapi\.zrkgroup\.com\//i.test(url);
}

export function localThumbPath(code: string): string {
  return `/catalog-textures/zrk/thumbs/${code}.webp`;
}

export function localFullPath(code: string): string {
  return `/catalog-textures/zrk/${code}.webp`;
}

/** Download Strapi image → local thumb (1024px) + full (≤2048px) webp. Skips if both exist. */
export async function mirrorZrkTexture(
  code: string,
  remoteUrl: string,
  opts?: { force?: boolean }
): Promise<MirroredTexture> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(THUMB_DIR, { recursive: true });

  const thumbDisk = path.join(THUMB_DIR, `${code}.webp`);
  const fullDisk = path.join(OUT_DIR, `${code}.webp`);
  const thumbUrl = localThumbPath(code);
  const imageUrl = localFullPath(code);

  const hasBoth = (await fileExists(thumbDisk)) && (await fileExists(fullDisk));
  if (hasBoth && !opts?.force) {
    return { code, thumbUrl, imageUrl, remoteUrl };
  }

  const res = await fetch(remoteUrl, {
    headers: { "User-Agent": "ArtisanInteriors-ZRK-Mirror/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch ${code} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  if (!hasBoth || opts?.force) {
    // Full sheet stays book-matched for seamless studio tiling (near-Strapi quality).
    await sharp(buf)
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 92 })
      .toFile(fullDisk);

    // Catalog thumb: crop away mirror seam when present.
    await writeDemirroredThumb(buf, thumbDisk, 1024);
  }

  return { code, thumbUrl, imageUrl, remoteUrl };
}

export async function mirrorZrkTextures(
  items: { code: string; remoteUrl: string }[],
  opts?: { concurrency?: number; force?: boolean }
): Promise<{ mirrored: MirroredTexture[]; errors: string[] }> {
  const concurrency = opts?.concurrency ?? 6;
  const mirrored: MirroredTexture[] = [];
  const errors: string[] = [];
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const item = items[i];
      try {
        mirrored.push(await mirrorZrkTexture(item.code, item.remoteUrl, opts));
      } catch (e) {
        errors.push(`${item.code}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return { mirrored, errors };
}
