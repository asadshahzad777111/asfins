"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function AdminLoginForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/scenes");
      router.refresh();
    } else {
      setError(t("wrongPassword"));
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-walnut">
      <div className="flex justify-end px-4 py-4">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-sm border border-divider bg-marble p-8 shadow-lg"
        >
        <p className="font-mono-data text-xs uppercase tracking-[0.2em] text-brass">
          {t("adminLogin")}
        </p>
        <h1 className="font-display mt-2 text-2xl text-charcoal">{t("colorVisualizer")}</h1>
        <p className="mt-2 text-sm text-muted">{t("loginSubtitle")}</p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <label className="mt-6 block">
          <span className="text-sm font-medium">{t("password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-sm border border-divider bg-base px-4 py-3"
            required
            autoFocus
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-sm bg-brass py-3.5 text-sm font-medium text-marble disabled:opacity-50"
        >
          {loading ? t("loggingIn") : t("login")}
        </button>

        <p className="mt-4 text-center font-mono-data text-[10px] text-muted">
          {t("defaultPasswordHint")}
        </p>
        </form>
      </div>
    </div>
  );
}
