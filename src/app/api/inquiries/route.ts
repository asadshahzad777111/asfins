import { NextRequest, NextResponse } from "next/server";
import { addInquiry } from "@/lib/inquiries/registry";
import type { Inquiry } from "@/lib/inquiries/types";

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    phone?: string;
    message?: string;
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
  const message = String(body.message ?? "").trim();

  if (!name || !phone) {
    return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
  }

  const inquiry: Inquiry = {
    id: `inq-${Date.now()}`,
    name,
    phone,
    message: message || "WhatsApp inquiry from configurator",
    sceneId: body.sceneId,
    sceneName: body.sceneName,
    zoneSummary: body.zoneSummary,
    createdAt: new Date().toISOString(),
  };

  await addInquiry(inquiry);
  return NextResponse.json({ ok: true, inquiry }, { status: 201 });
}
