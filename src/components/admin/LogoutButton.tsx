"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useLanguage();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={
        className ??
        "rounded-sm border border-marble/30 px-3 py-1.5 font-mono-data text-xs text-marble/80 hover:bg-marble/10"
      }
    >
      {t("logout")}
    </button>
  );
}
