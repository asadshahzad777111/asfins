"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface QuoteInterestFormProps {
  source?: "contact" | "studio" | "other";
}

export function QuoteInterestForm({ source = "contact" }: QuoteInterestFormProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle"
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          message: message.trim() || "Quote interest from contact page",
          source,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("ok");
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <p className="border border-ink bg-paper p-6 text-[15px] leading-relaxed text-ink">
        {t("quoteFormSuccess")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="quote-name" className="mb-1.5 block text-[12px] uppercase tracking-[0.12em] text-muted">
          {t("quoteFormName")}
        </label>
        <input
          id="quote-name"
          type="text"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-ink bg-paper px-3 py-3 text-[14px] focus:outline-none"
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="quote-phone" className="mb-1.5 block text-[12px] uppercase tracking-[0.12em] text-muted">
          {t("quoteFormPhone")}
        </label>
        <input
          id="quote-phone"
          type="tel"
          required
          maxLength={30}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border border-ink bg-paper px-3 py-3 text-[14px] focus:outline-none"
          autoComplete="tel"
        />
      </div>
      <div>
        <label htmlFor="quote-email" className="mb-1.5 block text-[12px] uppercase tracking-[0.12em] text-muted">
          {t("quoteFormEmail")}
        </label>
        <input
          id="quote-email"
          type="email"
          maxLength={160}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-ink bg-paper px-3 py-3 text-[14px] focus:outline-none"
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="quote-message" className="mb-1.5 block text-[12px] uppercase tracking-[0.12em] text-muted">
          {t("quoteFormMessage")}
        </label>
        <textarea
          id="quote-message"
          rows={4}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-y border border-ink bg-paper px-3 py-3 text-[14px] focus:outline-none"
        />
      </div>
      {status === "error" && (
        <p className="text-[13px] text-brass">{t("quoteFormError")}</p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="bg-ink px-6 py-3 text-[13px] text-paper transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {status === "sending" ? t("quoteFormSending") : t("quoteFormSubmit")}
      </button>
    </form>
  );
}
