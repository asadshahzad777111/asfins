/**
 * Best-effort WhatsApp alerts for quote/contact inquiries.
 * Adapted from asfix-gear otpDelivery notify helpers — no cart/orders.
 * Silently skipped when Meta Cloud API env vars are not configured.
 */

const BRAND = "ASFins";

function shopWhatsAppIntl(): string {
  const raw =
    process.env.SHOP_WHATSAPP_INTL ||
    process.env.NEXT_PUBLIC_WHATSAPP ||
    "923039227000";
  return String(raw).replace(/\D/g, "") || "923039227000";
}

function whatsAppCloudConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

/** Pakistan-friendly digits → E.164 without leading +. */
export function normalizePhoneDigits(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits;
}

async function sendWhatsAppCloud(toDigits: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN!.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits.replace(/^\+/, ""),
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp Cloud API failed: ${res.status}`);
  }
}

export async function notifyShopWhatsApp(
  text: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!whatsAppCloudConfigured()) {
    return { sent: false, skipped: true };
  }
  try {
    await sendWhatsAppCloud(shopWhatsAppIntl(), text);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[Inquiry] Shop WhatsApp notify failed:", message);
    return { sent: false, error: message };
  }
}

export async function notifyCustomerWhatsApp(
  phone: string,
  text: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!whatsAppCloudConfigured()) return { sent: false, skipped: true };
  const digits = normalizePhoneDigits(phone);
  if (!digits) return { sent: false, skipped: true };
  try {
    await sendWhatsAppCloud(digits, text);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[Inquiry] Customer WhatsApp confirm failed:", message);
    return { sent: false, error: message };
  }
}

export function buildInquiryShopAlert(inquiry: {
  name: string;
  phone: string;
  email?: string;
  message: string;
  source?: string;
  sceneName?: string;
}): string {
  const excerpt =
    inquiry.message.length > 160
      ? `${inquiry.message.slice(0, 160)}...`
      : inquiry.message;
  return [
    `NEW INQUIRY - ${BRAND}`,
    "---------------------",
    `Name: ${inquiry.name}`,
    `Phone: ${inquiry.phone}`,
    inquiry.email ? `Email: ${inquiry.email}` : null,
    inquiry.source ? `Source: ${inquiry.source}` : null,
    inquiry.sceneName ? `Scene: ${inquiry.sceneName}` : null,
    "---------------------",
    excerpt,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInquiryCustomerAck(name: string): string {
  const shop = shopWhatsAppIntl();
  const local = shop.startsWith("92") ? `0${shop.slice(2)}` : shop;
  return [
    `Assalam o Alaikum ${name}!`,
    `${BRAND} — aapka quote request receive ho gaya.`,
    "Hum jald reply karenge.",
    `WhatsApp: ${local}`,
  ].join("\n");
}

export function buildOrderShopAlert(order: {
  orderNumber: string;
  name: string;
  phone: string;
  city?: string;
  note?: string;
  totalPKR: number;
  items: { name: string; qty: number; pricePKR: number }[];
}): string {
  const lines = order.items
    .slice(0, 12)
    .map(
      (i) =>
        `• ${i.qty}× ${i.name} — PKR ${(i.pricePKR * i.qty).toLocaleString("en-PK")}`
    );
  if (order.items.length > 12) {
    lines.push(`… +${order.items.length - 12} more`);
  }
  return [
    `NEW ORDER - ${BRAND}`,
    "---------------------",
    `Order: ${order.orderNumber}`,
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    order.city ? `City: ${order.city}` : null,
    "Payment: COD",
    "---------------------",
    ...lines,
    "---------------------",
    `Total: PKR ${order.totalPKR.toLocaleString("en-PK")}`,
    order.note ? `Note: ${order.note.slice(0, 160)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOrderCustomerAck(name: string, orderNumber: string): string {
  const shop = shopWhatsAppIntl();
  const local = shop.startsWith("92") ? `0${shop.slice(2)}` : shop;
  return [
    `Assalam o Alaikum ${name}!`,
    `${BRAND} — aapka order ${orderNumber} receive ho gaya.`,
    "Payment: Cash on delivery / pickup.",
    "Hum jald confirm karenge.",
    `WhatsApp: ${local}`,
  ].join("\n");
}
