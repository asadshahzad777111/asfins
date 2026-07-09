import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  listCatalogs,
  saveCatalog,
  deleteCatalog,
  slugifyCatalogId,
} from "@/lib/catalogs/registry";
import type { Catalog, CatalogSwatch } from "@/lib/catalogs/types";

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const catalogs = await listCatalogs();
  return NextResponse.json({ catalogs });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: string;
    companyName?: string;
    swatches?: CatalogSwatch[];
    global?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyName = String(body.companyName ?? "").trim();
  if (!companyName) {
    return NextResponse.json({ error: "Company name required" }, { status: 400 });
  }

  const catalog: Catalog = {
    id: body.id || slugifyCatalogId(companyName),
    companyName,
    swatches: body.swatches ?? [],
    global: body.global ?? true,
    createdAt: new Date().toISOString(),
  };

  await saveCatalog(catalog);
  return NextResponse.json({ ok: true, catalog }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Catalog;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || !body.companyName) {
    return NextResponse.json({ error: "Catalog id and company name required" }, { status: 400 });
  }

  await saveCatalog(body);
  return NextResponse.json({ ok: true, catalog: body });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Catalog id required" }, { status: 400 });

  const ok = await deleteCatalog(id);
  if (!ok) return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
