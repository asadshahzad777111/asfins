/**
 * Resend transactional email for quote/contact inquiries.
 * Pattern adapted from asfix-gear otpDelivery sendViaResend — no cart/orders.
 * Silently skipped when RESEND_API_KEY is unset.
 */

import { SITE } from "@/lib/site";

const BRAND = SITE.displayName;

function resendConfigured(): boolean {
  return Boolean(String(process.env.RESEND_API_KEY || "").trim());
}

function getResendFrom(): string {
  const raw = String(process.env.RESEND_FROM || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (raw.includes("@")) return raw;
  // Prefer verified asfins domain; falls back to Resend onboarding sender for tests
  return `"${BRAND}" <noreply@asfins.com>`;
}

function getAdminNotifyEmail(): string {
  const raw = String(
    process.env.ADMIN_NOTIFY_EMAIL ||
      process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
      SITE.email ||
      ""
  )
    .trim()
    .toLowerCase();
  return raw.includes("@") ? raw : "";
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const payload: Record<string, unknown> = {
    from: getResendFrom(),
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  };
  if (opts.replyTo?.includes("@")) {
    payload.reply_to = opts.replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

export type InquiryEmailPayload = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  source?: string;
  sceneName?: string;
  zoneSummary?: string;
};

function wrapStaffHtml(inquiry: InquiryEmailPayload): string {
  const rows = [
    ["Name", inquiry.name],
    ["Phone", inquiry.phone],
    inquiry.email ? ["Email", inquiry.email] : null,
    inquiry.source ? ["Source", inquiry.source] : null,
    inquiry.sceneName ? ["Scene", inquiry.sceneName] : null,
    ["ID", inquiry.id],
  ].filter(Boolean) as [string, string][];

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#64748b;width:110px;">${escapeHtml(k)}</td><td style="padding:6px 0;color:#0f172a;">${escapeHtml(v)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Segoe UI,system-ui,sans-serif;color:#0f172a;">
  <table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
      <h1 style="margin:0;font-size:18px;">New inquiry — ${escapeHtml(BRAND)}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#64748b;">asfins.com quote / contact</p>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <table width="100%">${rowHtml}</table>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(inquiry.message)}</p>
      ${inquiry.zoneSummary ? `<p style="margin:12px 0 0;font-size:12px;color:#64748b;">${escapeHtml(inquiry.zoneSummary)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:14px 24px;background:#f8fafc;font-size:11px;color:#94a3b8;">
      Admin inbox: ${escapeHtml(SITE.url)}/admin/inquiries
    </td></tr>
  </table>
</body></html>`;
}

function wrapCustomerHtml(name: string): string {
  const wa = SITE.whatsapp.startsWith("92")
    ? `0${SITE.whatsapp.slice(2)}`
    : SITE.whatsapp;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Segoe UI,system-ui,sans-serif;color:#0f172a;">
  <table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
      <h1 style="margin:0;font-size:18px;">${escapeHtml(BRAND)}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#64748b;">Quote request received</p>
    </td></tr>
    <tr><td style="padding:20px 24px;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 12px;">Assalam o Alaikum ${escapeHtml(name)},</p>
      <p style="margin:0 0 12px;">Aapka quote request mil gaya hai. Hum jald WhatsApp / email par reply karenge.</p>
      <p style="margin:0;">WhatsApp: <strong>${escapeHtml(wa)}</strong></p>
    </td></tr>
    <tr><td style="padding:14px 24px;background:#f8fafc;font-size:11px;color:#94a3b8;">
      ${escapeHtml(SITE.url)} · ${escapeHtml(SITE.city)}
    </td></tr>
  </table>
</body></html>`;
}

/** Staff alert when a new inquiry is saved. */
export async function notifyAdminInquiryEmail(
  inquiry: InquiryEmailPayload
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!resendConfigured()) return { sent: false, skipped: true };
  const to = getAdminNotifyEmail();
  if (!to) return { sent: false, skipped: true, error: "no_admin_email" };

  const subject = `[${BRAND}] New inquiry from ${inquiry.name}`;
  const text = [
    `New inquiry — ${BRAND}`,
    `Name: ${inquiry.name}`,
    `Phone: ${inquiry.phone}`,
    inquiry.email ? `Email: ${inquiry.email}` : null,
    inquiry.source ? `Source: ${inquiry.source}` : null,
    inquiry.sceneName ? `Scene: ${inquiry.sceneName}` : null,
    "",
    inquiry.message,
    "",
    `Admin: ${SITE.url}/admin/inquiries`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendViaResend({
      to,
      subject,
      html: wrapStaffHtml(inquiry),
      text,
      replyTo: inquiry.email,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[Inquiry] Admin Resend failed:", message);
    return { sent: false, error: message };
  }
}

/** Optional ack to the customer if they left an email. */
export async function notifyCustomerInquiryEmail(
  inquiry: InquiryEmailPayload
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!resendConfigured()) return { sent: false, skipped: true };
  const to = String(inquiry.email || "")
    .trim()
    .toLowerCase();
  if (!to.includes("@")) return { sent: false, skipped: true };

  const subject = `${BRAND} — we received your quote request`;
  const text = [
    `Assalam o Alaikum ${inquiry.name},`,
    "",
    "Aapka quote request mil gaya hai. Hum jald reply karenge.",
    `WhatsApp: ${SITE.whatsapp.startsWith("92") ? `0${SITE.whatsapp.slice(2)}` : SITE.whatsapp}`,
    "",
    `— ${BRAND}`,
  ].join("\n");

  try {
    await sendViaResend({
      to,
      subject,
      html: wrapCustomerHtml(inquiry.name),
      text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[Inquiry] Customer Resend failed:", message);
    return { sent: false, error: message };
  }
}

export function isResendConfigured(): boolean {
  return resendConfigured();
}
