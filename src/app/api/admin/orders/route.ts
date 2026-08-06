import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import { listOrders, updateOrderStatus } from "@/lib/orders/registry";
import type { OrderStatus } from "@/lib/orders/types";

const ALLOWED: Set<OrderStatus> = new Set([
  "new",
  "confirmed",
  "done",
  "cancelled",
]);

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await listOrders();
  return NextResponse.json({ orders });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const status = String(body.status ?? "").trim() as OrderStatus;
  if (!id || !ALLOWED.has(status)) {
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 });
  }

  const order = await updateOrderStatus(id, status);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}
