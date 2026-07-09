import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { listSales, saveSale, deleteSale, slugifySaleId } from "@/lib/sales/registry";
import type { Sale } from "@/lib/sales/types";

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sales = await listSales();
  return NextResponse.json({ sales });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const customerName = String(body.customerName ?? "").trim();
  const productName = String(body.productName ?? "").trim();
  const amountPKR = Number(body.amountPKR ?? 0);
  const status = (body.status ?? "pending") as Sale["status"];
  const notes = String(body.notes ?? "").trim();

  if (!customerName || !productName || amountPKR <= 0) {
    return NextResponse.json({ error: "Customer, product, and amount required" }, { status: 400 });
  }

  const sale: Sale = {
    id: slugifySaleId(`${customerName}-${Date.now()}`),
    customerName,
    productName,
    amountPKR,
    status: ["pending", "completed", "cancelled"].includes(status) ? status : "pending",
    notes,
    createdAt: new Date().toISOString(),
  };

  await saveSale(sale);
  return NextResponse.json({ ok: true, sale }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Sale id required" }, { status: 400 });

  const ok = await deleteSale(id);
  if (!ok) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
