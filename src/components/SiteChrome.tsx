"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV_LINKS = [
  { href: "/studio", key: "virtualDesignStudio" as const },
  { href: "/gallery", key: "gallery" as const },
  { href: "/products", key: "products" as const },
];

export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();

  return (
    <header className="site-header-glass sticky top-0 z-50 border-b border-white/10 text-marble">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/studio" className="flex shrink-0 flex-col">
          <p className="font-display text-lg leading-tight tracking-tight sm:text-xl">{SHOP.name}</p>
          <p className="font-mono-data text-[9px] uppercase tracking-[0.22em] text-marble/55">
            {SHOP.legalName} · {SHOP.city}
          </p>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 font-mono-data text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  active ? "text-brass" : "text-marble/55 hover:text-marble"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/admin"
            className="hidden font-mono-data text-[10px] uppercase tracking-[0.14em] text-marble/50 transition-colors hover:text-brass sm:inline"
          >
            {t("admin")}
          </Link>
          <LanguageSwitcher variant="dark" />
          <Link
            href="/studio/kitchen"
            className="btn-shine bg-brass px-3 py-2.5 font-mono-data text-[10px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-[#d4a04a] sm:px-4"
          >
            {t("enterStudio")}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto border-t border-divider bg-walnut py-10 text-marble/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="font-display text-xl text-marble">{SHOP.name}</p>
            <p className="mt-1 font-mono-data text-[10px] uppercase tracking-[0.2em] text-brass/80">
              {t("atelierMark")}
            </p>
            <p className="mt-2 text-sm text-marble/45">{t("shopTagline")}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 font-mono-data text-[10px] uppercase tracking-[0.14em]">
            <Link href="/studio" className="hover:text-brass">
              {t("virtualDesignStudio")}
            </Link>
            <Link href="/gallery" className="hover:text-brass">
              {t("gallery")}
            </Link>
            <Link href="/products" className="hover:text-brass">
              {t("products")}
            </Link>
            <Link href="/admin" className="hover:text-brass">
              {t("admin")}
            </Link>
          </div>
        </div>
        <p className="font-mono-data mt-8 text-center text-[10px] text-marble/35 sm:text-left">
          © {new Date().getFullYear()} {SHOP.name} · {t("madeInPakistan")}
        </p>
      </div>
    </footer>
  );
}
