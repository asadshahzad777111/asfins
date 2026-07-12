"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Inquiry, InquiryStatus } from "@/lib/inquiries/types";
import { SITE } from "@/lib/site";

interface InquiriesAdminProps {
  initialInquiries: Inquiry[];
}

export function InquiriesAdmin({ initialInquiries }: InquiriesAdminProps) {
  const { t } = useLanguage();
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: InquiryStatus) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { inquiry: Inquiry };
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? data.inquiry : inq))
      );
    } catch {
      alert(t("inquiryUpdateError"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("deleteInquiryConfirm"))) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      setInquiries((prev) => prev.filter((inq) => inq.id !== id));
    } catch {
      alert(t("inquiryUpdateError"));
    } finally {
      setBusyId(null);
    }
  }

  function customerWa(phone: string, name: string) {
    const digits = phone.replace(/\D/g, "");
    const intl = digits.startsWith("92")
      ? digits
      : digits.startsWith("0")
        ? `92${digits.slice(1)}`
        : digits.length === 10
          ? `92${digits}`
          : SITE.whatsapp;
    const text = encodeURIComponent(
      `Assalam o Alaikum ${name}, ASFins se baat kar rahe hain regarding aapki quote inquiry.`
    );
    return `https://wa.me/${intl}?text=${text}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-charcoal">{t("adminInquiriesTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("adminInquiriesSubtitle")}</p>
      </div>

      {inquiries.length === 0 ? (
        <p className="rounded-sm border border-divider bg-marble p-6 text-sm text-muted">
          {t("emptyInquiries")}
        </p>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const status = inq.status ?? "new";
            const busy = busyId === inq.id;
            return (
              <div key={inq.id} className="rounded-sm border border-divider bg-marble p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-sm">{inq.name}</p>
                    <p className="font-mono-data text-xs text-muted">{inq.phone}</p>
                    {inq.email && (
                      <p className="font-mono-data text-xs text-muted">{inq.email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono-data text-[10px] uppercase text-muted">
                      {status}
                      {inq.source ? ` · ${inq.source}` : ""}
                    </p>
                    <p className="font-mono-data text-[10px] text-muted">
                      {new Date(inq.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {inq.sceneName && (
                  <p className="mt-2 text-xs text-brass">
                    {t("sceneLabel", { name: inq.sceneName })}
                  </p>
                )}
                {inq.zoneSummary && (
                  <p className="mt-1 text-xs text-muted">{inq.zoneSummary}</p>
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm">{inq.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={customerWa(inq.phone, inq.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-paper"
                  >
                    WhatsApp
                  </a>
                  {status === "new" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(inq.id, "read")}
                      className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-paper disabled:opacity-50"
                    >
                      {t("inquiryMarkRead")}
                    </button>
                  )}
                  {status !== "replied" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(inq.id, "replied")}
                      className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-paper disabled:opacity-50"
                    >
                      {t("inquiryMarkReplied")}
                    </button>
                  )}
                  {status !== "archived" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(inq.id, "archived")}
                      className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-paper disabled:opacity-50"
                    >
                      {t("inquiryArchive")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(inq.id)}
                    className="border border-divider px-2 py-1 text-[11px] uppercase tracking-wide text-brass hover:bg-paper disabled:opacity-50"
                  >
                    {t("inquiryDelete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
