import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { getCatalogById, saveCatalog } from "@/lib/catalogs/registry";
import { getProductById, saveProduct } from "@/lib/products/registry";
import {
  importZrkBulkRows,
  ZRK_CATALOG_ID,
  type ZrkBulkRow,
} from "@/lib/zrk/bulk-import";
import {
  isRemoteZrkUrl,
  mirrorZrkTextures,
} from "@/lib/zrk/mirror-texture";
import { syncNewZrkProducts } from "@/lib/zrk/scraper";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let mirror = true;
  try {
    const body = await request.json();
    mirror = body.mirror !== false;
  } catch {
    // default mirror on
  }

  const catalog = await getCatalogById(ZRK_CATALOG_ID);
  if (!catalog) {
    return NextResponse.json({ error: "ZRK catalog not found" }, { status: 404 });
  }

  const existingCodes = new Set(
    catalog.swatches.map((s) => s.sheetCode).filter(Boolean)
  );

  const { rows, errors, newPaths, totalOnSite } =
    await syncNewZrkProducts(existingCodes);

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      added: 0,
      updated: 0,
      newProducts: 0,
      totalOnSite,
      alreadyHave: totalOnSite,
      message: "Koi naya product nahi — sab up to date hain.",
      errors,
    });
  }

  let importRows: ZrkBulkRow[] = rows;

  if (mirror) {
    const toMirror = rows
      .filter((r) => isRemoteZrkUrl(r.imageUrl))
      .map((r) => ({ code: r.sheetCode, remoteUrl: r.imageUrl }));

    const { mirrored, errors: mirrorErrors } = await mirrorZrkTextures(toMirror);
    errors.push(...mirrorErrors);

    const byCode = new Map(mirrored.map((m) => [m.code, m]));
    importRows = rows.map((r) => {
      const m = byCode.get(r.sheetCode);
      if (!m) return r;
      return {
        ...r,
        imageUrl: m.imageUrl,
        thumbUrl: m.thumbUrl,
      };
    });
  }

  const result = await importZrkBulkRows(importRows, {
    getCatalog: getCatalogById,
    saveCatalog,
    getProduct: getProductById,
    saveProduct,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    newProducts: newPaths.length,
    totalOnSite,
    mirrored: mirror,
    message: `${result.added} naye products add hue, ${result.updated} update`,
    errors,
  });
}

/** Mirror all remote ZRK images in catalog to local fast webp files. */
export async function PUT(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const catalog = await getCatalogById(ZRK_CATALOG_ID);
  if (!catalog) {
    return NextResponse.json({ error: "ZRK catalog not found" }, { status: 404 });
  }

  const toMirror = catalog.swatches
    .filter((s) => s.sheetCode && isRemoteZrkUrl(s.imageUrl))
    .map((s) => ({ code: s.sheetCode, remoteUrl: s.imageUrl! }));

  if (toMirror.length === 0) {
    return NextResponse.json({
      ok: true,
      mirrored: 0,
      message: "Sab images pehle se local hain — fast loading ready.",
    });
  }

  const { mirrored, errors } = await mirrorZrkTextures(toMirror, {
    concurrency: 8,
  });

  const byCode = new Map(mirrored.map((m) => [m.code, m]));
  const swatches = catalog.swatches.map((s) => {
    const m = byCode.get(s.sheetCode);
    if (!m) return s;
    return { ...s, imageUrl: m.imageUrl, thumbUrl: m.thumbUrl };
  });

  await saveCatalog({ ...catalog, swatches });

  for (const m of mirrored) {
    const product = await getProductById(`zrk-${m.code}`);
    if (product) {
      await saveProduct({
        ...product,
        image: m.thumbUrl,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mirrored: mirrored.length,
    remaining: toMirror.length - mirrored.length,
    errors,
    message: `${mirrored.length} textures local save — ab catalog fast load hogi.`,
  });
}
