"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function ZrkAutoSync() {
  const { t } = useLanguage();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [mirroring, setMirroring] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/zrk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mirror: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setMessage({
        type: "ok",
        text: data.message ?? `${data.added ?? 0} added`,
      });
      router.refresh();
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Sync failed",
      });
    }
    setSyncing(false);
  }

  async function handleMirrorAll() {
    setMirroring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/zrk-sync", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Mirror failed");
      setMessage({
        type: "ok",
        text: data.message ?? `${data.mirrored ?? 0} mirrored`,
      });
      router.refresh();
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "Mirror failed",
      });
    }
    setMirroring(false);
  }

  return (
    <div className="rounded-sm border border-emerald-600/30 bg-emerald-50/50 p-5">
      <h2 className="font-display text-lg text-charcoal">{t("zrkSyncTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("zrkSyncDesc")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={syncing || mirroring}
          onClick={() => void handleSync()}
          className="rounded-sm bg-emerald-700 px-6 py-2.5 text-sm text-white disabled:opacity-50"
        >
          {syncing ? t("zrkSyncRunning") : t("zrkSyncBtn")}
        </button>
        <button
          type="button"
          disabled={syncing || mirroring}
          onClick={() => void handleMirrorAll()}
          className="rounded-sm border border-emerald-700 px-6 py-2.5 text-sm text-emerald-800 disabled:opacity-50"
        >
          {mirroring ? t("zrkMirrorRunning") : t("zrkMirrorBtn")}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">{t("zrkSyncCronHint")}</p>

      {message && (
        <p
          className={`mt-3 rounded-sm px-3 py-2 text-sm ${
            message.type === "ok"
              ? "border border-emerald-200 bg-white text-charcoal"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
