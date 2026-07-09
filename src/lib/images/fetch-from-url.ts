import sharp from "sharp";

const MAX_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

export class ImageFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageFetchError";
  }
}

export async function fetchImageFromUrl(
  rawUrl: string
): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ImageFetchError("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ImageFetchError("URL must use http or https");
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "ArtisanColorConfigurator/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new ImageFetchError(`Could not fetch image (HTTP ${res.status})`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new ImageFetchError("Image is empty");
  }
  if (buffer.length > MAX_BYTES) {
    throw new ImageFetchError("Image too large (max 20 MB)");
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new ImageFetchError("URL does not point to a valid image");
  }

  if (!meta.width || !meta.height) {
    throw new ImageFetchError("URL does not point to a valid image");
  }

  const format = meta.format ?? "jpeg";
  const ext =
    format === "png" ? ".png" : format === "webp" ? ".webp" : ".jpg";
  const mime = `image/${format === "jpg" ? "jpeg" : format}`;

  return { buffer, ext, mime };
}
