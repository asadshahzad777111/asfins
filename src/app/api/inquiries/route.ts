import { NextRequest, NextResponse } from "next/server";
import { addInquiry } from "@/lib/inquiries/registry";
import type { Inquiry, InquirySource } from "@/lib/inquiries/types";
import {
  buildInquiryCustomerAck,
  buildInquiryShopAlert,
  notifyCustomerWhatsApp,
  notifyShopWhatsApp,
} from "@/lib/notify/whatsapp";
import {
  notifyAdminInquiryEmail,
  notifyCustomerInquiryEmail,
} from "@/lib/notify/email";

const MAX_NAME = 120;
const MAX_EMAIL = 160;
const MAX_PHONE = 30;
const MAX_MESSAGE = 2000;
const ALLOWED_SOURCES = new Set<InquirySource>([
  "contact",
  "studio",
  "whatsapp",
  "other",
]);

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    phone?: string;
    email?: string;
    message?: string;
    source?: string;
    sceneId?: string;
    sceneName?: string;
    zoneSummary?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const rawSource = String(body.source ?? "contact").trim() as InquirySource;
  const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "contact";

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (phone.length > MAX_PHONE) {
    return NextResponse.json({ error: "Phone too long" }, { status: 400 });
  }
  if (email.length > MAX_EMAIL) {
    return NextResponse.json({ error: "Email too long" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const inquiry: Inquiry = {
    id: `inq-${Date.now()}`,
    name,
    phone,
    email: email || undefined,
    message: message || "Quote interest from website",
    source,
    status: "new",
    sceneId: body.sceneId ? String(body.sceneId).trim() : undefined,
    sceneName: body.sceneName ? String(body.sceneName).trim() : undefined,
    zoneSummary: body.zoneSummary ? String(body.zoneSummary).trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await addInquiry(inquiry);
  } catch (err) {
    console.error("[inquiries] save failed:", err);
    return NextResponse.json({ error: "Could not save inquiry" }, { status: 503 });
  }

  // Best-effort staff + customer WhatsApp/email — never fail the HTTP response
  notifyShopWhatsApp(buildInquiryShopAlert(inquiry)).catch(() => {});
  notifyCustomerWhatsApp(phone, buildInquiryCustomerAck(name)).catch(() => {});
  notifyAdminInquiryEmail(inquiry).catch(() => {});
  notifyCustomerInquiryEmail(inquiry).catch(() => {});

  return NextResponse.json({ ok: true, inquiry }, { status: 201 });
}
