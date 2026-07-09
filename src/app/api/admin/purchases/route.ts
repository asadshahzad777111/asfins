import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  listPurchases,
  savePurchase,
  deletePurchase,
  slugifyPurchaseId,
} from "@/lib/purchases/registry";
import type { Purchase } from "@/lib/purchases/types";

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const purchases = await listPurchases();
  return NextResponse.json({ purchases });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supplierName = String(body.supplierName ?? "").trim();
  const itemName = String(body.itemName ?? "").trim();
  const amountPKR = Number(body.amountPKR ?? 0);
  const status = (body.status ?? "ordered") as Purchase["status"];
  const notes = String(body.notes ?? "").trim();

  if (!supplierName || !itemName || amountPKR <= 0) {
    return NextResponse.json({ error: "Supplier, item, and amount required" }, { status: 400 });
  }

  const purchase: Purchase = {
    id: slugifyPurchaseId(`${supplierName}-${Date.now()}`),
    supplierName,
    itemName,
    amountPKR,
    status: ["ordered", "received", "cancelled"].includes(status) ? status : "ordered",
    notes,
    createdAt: new Date().toISOString(),
  };

  await savePurchase(purchase);
  return NextResponse.json({ ok: true, purchase }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Purchase id required" }, { status: 400 });

  const ok = await deletePurchase(id);
  if (!ok) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
