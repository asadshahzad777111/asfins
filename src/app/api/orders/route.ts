import { NextRequest, NextResponse } from "next/server";
import {
  createOrderId,
  nextOrderNumber,
  saveOrder,
} from "@/lib/orders/registry";
import type { OrderLineItem, ShopOrder } from "@/lib/orders/types";
import { getProductById } from "@/lib/products/registry";
import {
  buildOrderCustomerAck,
  buildOrderShopAlert,
  notifyCustomerWhatsApp,
  notifyShopWhatsApp,
} from "@/lib/notify/whatsapp";

const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_CITY = 80;
const MAX_NOTE = 500;
const MAX_ITEMS = 40;

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    phone?: string;
    city?: string;
    note?: string;
    items?: { productId?: string; qty?: number }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const city = String(body.city ?? "").trim();
  const note = String(body.note ?? "").trim();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }
  if (name.length > MAX_NAME || phone.length > MAX_PHONE) {
    return NextResponse.json({ error: "Name or phone too long" }, { status: 400 });
  }
  if (city.length > MAX_CITY || note.length > MAX_NOTE) {
    return NextResponse.json({ error: "City or note too long" }, { status: 400 });
  }
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: "Cart items required" }, { status: 400 });
  }

  const lineItems: OrderLineItem[] = [];
  for (const row of rawItems) {
    const productId = String(row.productId ?? "").trim();
    const qty = Math.floor(Number(row.qty ?? 0));
    if (!productId || qty < 1 || qty > 999) {
      return NextResponse.json({ error: "Invalid cart line" }, { status: 400 });
    }
    const product = await getProductById(productId);
    if (!product || !product.active) {
      return NextResponse.json(
        { error: `Product unavailable: ${productId}` },
        { status: 400 }
      );
    }
    lineItems.push({
      productId: product.id,
      name: product.name,
      pricePKR: product.pricePKR,
      qty,
      image: product.image,
      category: product.category,
    });
  }

  const totalPKR = lineItems.reduce((n, i) => n + i.pricePKR * i.qty, 0);
  const orderNumber = await nextOrderNumber();
  const now = new Date().toISOString();

  const order: ShopOrder = {
    id: createOrderId(),
    orderNumber,
    name,
    phone,
    city: city || undefined,
    note: note || undefined,
    paymentMethod: "cod",
    items: lineItems,
    totalPKR,
    status: "new",
    createdAt: now,
  };

  try {
    await saveOrder(order);
  } catch (err) {
    console.error("[orders] save failed:", err);
    return NextResponse.json({ error: "Could not save order" }, { status: 503 });
  }

  notifyShopWhatsApp(buildOrderShopAlert(order)).catch(() => {});
  notifyCustomerWhatsApp(phone, buildOrderCustomerAck(name, orderNumber)).catch(
    () => {}
  );

  return NextResponse.json({ ok: true, order }, { status: 201 });
}
