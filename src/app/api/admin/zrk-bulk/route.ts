import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { getCatalogById, saveCatalog } from "@/lib/catalogs/registry";
import { getProductById, saveProduct } from "@/lib/products/registry";
import {
  importZrkBulkRows,
  parseZrkBulkText,
  type ZrkBulkRow,
} from "@/lib/zrk/bulk-import";

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; items?: ZrkBulkRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let rows: ZrkBulkRow[] = [];
  const parseErrors: string[] = [];

  if (body.items?.length) {
    rows = body.items;
  } else if (body.text?.trim()) {
    const parsed = parseZrkBulkText(body.text);
    rows = parsed.rows;
    parseErrors.push(...parsed.errors);
  } else {
    return NextResponse.json({ error: "Provide text or items array" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No valid rows", parseErrors },
      { status: 400 }
    );
  }

  const result = await importZrkBulkRows(rows, {
    getCatalog: getCatalogById,
    saveCatalog,
    getProduct: getProductById,
    saveProduct,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    parseErrors,
    message: `Catalog + products: ${result.added} added, ${result.updated} updated`,
  });
}
