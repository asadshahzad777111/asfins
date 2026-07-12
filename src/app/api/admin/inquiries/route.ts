import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/admin/auth";
import {
  deleteInquiry,
  listInquiries,
  updateInquiry,
} from "@/lib/inquiries/registry";
import type { InquiryStatus } from "@/lib/inquiries/types";

const ALLOWED_STATUS = new Set<InquiryStatus>([
  "new",
  "read",
  "replied",
  "archived",
]);

export async function GET(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const inquiries = await listInquiries();
  return NextResponse.json({ inquiries });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; status?: string; staffNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Inquiry id required" }, { status: 400 });
  }

  const patch: { status?: InquiryStatus; staffNote?: string } = {};
  if (body.status != null) {
    const status = String(body.status).trim() as InquiryStatus;
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = status;
  }
  if (body.staffNote != null) {
    patch.staffNote = String(body.staffNote).trim().slice(0, 2000);
  }
  if (!patch.status && patch.staffNote === undefined) {
    return NextResponse.json(
      { error: "Provide status or staffNote" },
      { status: 400 }
    );
  }

  const updated = await updateInquiry(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, inquiry: updated });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminFromRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Inquiry id required" }, { status: 400 });
  }

  const ok = await deleteInquiry(id);
  if (!ok) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
