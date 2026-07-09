"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const EXAMPLE = `# One item per line — code | name | image URL | finish | colour | category | price
2030 | Vibrant Orange | https://strapi.zrkgroup.com/uploads/2030.png | Leather | Orange | Textured Laminates | 0
3001 | Reddish Brown Wood | /catalog-textures/zrk/3001.webp | High Gloss | Brown | Textured Laminates | 12500`;

export function ZrkBulkImport() {
  const { t } = useLanguage();
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleImport() {
    if (!text.trim()) return;
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/admin/zrk-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();

    if (res.ok) {
      const extra =
        data.parseErrors?.length > 0
          ? ` (${data.parseErrors.length} lines skipped)`
          : "";
      setMessage({
        type: "ok",
        text: `${data.message}${extra} — ${t("zrkBulkRateHint")}`,
      });
      setText("");
      router.refresh();
    } else {
      setMessage({
        type: "err",
        text: data.error ?? data.parseErrors?.join("; ") ?? "Import failed",
      });
    }
    setLoading(false);
  }

  return (
    <div className="rounded-sm border border-brass/30 bg-brass/5 p-5">
      <h2 className="font-display text-lg text-charcoal">{t("zrkBulkTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("zrkBulkDesc")}</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={EXAMPLE}
        className="mt-4 w-full rounded-sm border border-divider bg-base px-3 py-2 font-mono-data text-xs leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading || !text.trim()}
          onClick={() => void handleImport()}
          className="rounded-sm bg-brass px-6 py-2.5 text-sm text-marble disabled:opacity-50"
        >
          {loading ? t("importing") : t("zrkBulkImportBtn")}
        </button>
        <button
          type="button"
          onClick={() => setText(EXAMPLE)}
          className="text-xs text-brass"
        >
          {t("zrkBulkLoadExample")}
        </button>
        <span className="text-xs text-muted">{t("zrkBulkFormat")}</span>
      </div>

      {message && (
        <p
          className={`mt-3 rounded-sm px-3 py-2 text-sm ${
            message.type === "ok"
              ? "border border-brass/30 bg-white text-charcoal"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
