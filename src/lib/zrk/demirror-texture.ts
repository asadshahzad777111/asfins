import sharp from "sharp";

export type MirrorAxes = {
  leftRight: boolean;
  topBottom: boolean;
};

/**
 * ZRK Strapi sheets are often book-matched seamless tiles (left↔right,
 * sometimes also top↔bottom). Catalog swatches should show one continuous
 * grain, not the mirror seam — crop before making the thumb.
 *
 * Full textures stay untouched so studio tiling remains seamless.
 */
export async function detectMirrorAxes(
  input: Buffer | string
): Promise<MirrorAxes & { std: number; lr: number; tb: number }> {
  const { data, info } = await sharp(input)
    .resize(256, 256, { fit: "fill" })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const mid = Math.floor(w / 2);
  const midY = Math.floor(h / 2);

  let mean = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    mean += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  mean /= pixels;

  let varSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
    varSum += (v - mean) ** 2;
  }
  const std = Math.sqrt(varSum / pixels);

  let lrSum = 0;
  let lrN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < mid; x++) {
      const li = (y * w + x) * 4;
      const ri = (y * w + (w - 1 - x)) * 4;
      lrSum +=
        (Math.abs(data[li] - data[ri]) +
          Math.abs(data[li + 1] - data[ri + 1]) +
          Math.abs(data[li + 2] - data[ri + 2])) /
        3;
      lrN++;
    }
  }

  let tbSum = 0;
  let tbN = 0;
  for (let y = 0; y < midY; y++) {
    for (let x = 0; x < w; x++) {
      const ti = (y * w + x) * 4;
      const bi = ((h - 1 - y) * w + x) * 4;
      tbSum +=
        (Math.abs(data[ti] - data[bi]) +
          Math.abs(data[ti + 1] - data[bi + 1]) +
          Math.abs(data[ti + 2] - data[bi + 2])) /
        3;
      tbN++;
    }
  }

  const lr = lrSum / Math.max(1, lrN);
  const tb = tbSum / Math.max(1, tbN);
  const threshold = Math.max(10, std * 0.9);
  // Near-solid swatches always "match" themselves — skip those.
  const textured = std >= 5;

  return {
    leftRight: textured && lr < threshold,
    topBottom: textured && tb < threshold,
    std,
    lr,
    tb,
  };
}

/** Crop book-matched source down to one natural grain region. */
export async function extractNaturalGrain(
  input: Buffer | string,
  axes?: MirrorAxes
): Promise<sharp.Sharp> {
  const img = sharp(input);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 8 || h < 8) return sharp(input);

  const detected = axes ?? (await detectMirrorAxes(input));
  if (!detected.leftRight && !detected.topBottom) {
    return sharp(input);
  }

  const leftRight = detected.leftRight;
  const topBottom = detected.topBottom;
  const cropW = leftRight ? Math.max(1, Math.floor(w / 2)) : w;
  const cropH = topBottom ? Math.max(1, Math.floor(h / 2)) : h;

  return sharp(input).extract({ left: 0, top: 0, width: cropW, height: cropH });
}

/** Build a square catalog thumb with natural (non-mirrored) grain when needed. */
export async function writeDemirroredThumb(
  input: Buffer | string,
  outPath: string,
  size = 320
): Promise<MirrorAxes> {
  const axes = await detectMirrorAxes(input);
  const cropped = await extractNaturalGrain(input, axes);
  await cropped
    .resize(size, size, { fit: "cover" })
    .webp({ quality: 78 })
    .toFile(outPath);
  return { leftRight: axes.leftRight, topBottom: axes.topBottom };
}
