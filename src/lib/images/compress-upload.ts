/**
 * Client-side image shrink before admin scene uploads.
 * Vercel serverless request bodies cap at ~4.5MB — typical kitchen PNGs are 7–8MB each.
 */

const MAX_EDGE = 1600;
/** Soft budget per file so base + a few cutouts stay under the platform limit. */
const TARGET_BYTES = 1_200_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode image: ${file.name}`));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Image encode failed"));
      },
      type,
      quality
    );
  });
}

function drawScaled(
  img: HTMLImageElement,
  maxEdge: number
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, width, height };
}

/** Shrink a photo (base kitchen) to JPEG under the target size. */
export async function compressPhotoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file;
  }
  if (file.size <= TARGET_BYTES && file.type === "image/jpeg") {
    return file;
  }

  const img = await loadImage(file);
  let edge = MAX_EDGE;
  let quality = 0.82;

  for (let attempt = 0; attempt < 6; attempt++) {
    const { canvas } = drawScaled(img, edge);
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size <= TARGET_BYTES || (edge <= 960 && quality <= 0.55)) {
      const base = file.name.replace(/\.[^.]+$/, "") || "base";
      return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    }
    if (blob.size > TARGET_BYTES * 1.6) edge = Math.round(edge * 0.75);
    else quality = Math.max(0.5, quality - 0.1);
  }

  const { canvas } = drawScaled(img, 960);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.5);
  return new File([blob], "base.jpg", { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Shrink a cutout/mask PNG while preserving alpha.
 * Canvas PNG re-encode + downscale usually drops multi-MB files to a few hundred KB–1MB.
 */
export async function compressPngForUpload(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES && file.type === "image/png") {
    // Still cap absurd dimensions so merge/mask stay cheap on the server.
    const img = await loadImage(file);
    if (Math.max(img.naturalWidth, img.naturalHeight) <= MAX_EDGE) return file;
  }

  const img = await loadImage(file);
  let edge = MAX_EDGE;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { canvas } = drawScaled(img, edge);
    const blob = await canvasToBlob(canvas, "image/png");
    if (blob.size <= TARGET_BYTES || edge <= 960) {
      const base = file.name.replace(/\.[^.]+$/, "") || "cutout";
      return new File([blob], `${base}.png`, { type: "image/png", lastModified: Date.now() });
    }
    edge = Math.round(edge * 0.75);
  }

  const { canvas } = drawScaled(img, 960);
  const blob = await canvasToBlob(canvas, "image/png");
  return new File([blob], "cutout.png", { type: "image/png", lastModified: Date.now() });
}

export async function compressImageSourceFile(
  file: File,
  kind: "photo" | "png"
): Promise<File> {
  try {
    return kind === "photo"
      ? await compressPhotoForUpload(file)
      : await compressPngForUpload(file);
  } catch {
    // If decode fails (odd format), send the original — server will report a clear error.
    return file;
  }
}

/** Soft ceiling for a single multipart POST (Vercel ~4.5MB; leave headroom for fields). */
export const MAX_REQUEST_BYTES = 3_500_000;
