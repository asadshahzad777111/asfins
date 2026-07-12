"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV_LINKS = [
  { href: "/studio", key: "virtualDesignStudio" as const },
  { href: "/gallery", key: "gallery" as const },
  { href: "/products", key: "products" as const },
];

const HEADER_QUICK_LINKS = NAV_LINKS.filter((l) => l.href !== "/studio");

const ease = [0.22, 1, 0.36, 1] as const;

export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="site-header-glass sticky top-0 z-50 text-ink">
        <div className="flex items-center gap-3 px-[clamp(1.25rem,4vw,2.5rem)] py-4 sm:gap-4">
          <Link href="/studio" className="flex shrink-0 flex-col">
            <p className="font-display text-lg leading-none tracking-tight sm:text-xl">
              {SHOP.name}
              <span className="align-super text-[0.5em]">®</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
              {SHOP.legalName} · {SHOP.city}
            </p>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-underline text-[13px] transition-opacity ${
                    active ? "opacity-100" : "opacity-55 hover:opacity-100"
                  }`}
                >
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:gap-4">
            {/* Mobile: Gallery + Materials visible in the bar (not only Menu) */}
            <nav className="flex items-center gap-3 md:hidden" aria-label="Quick links">
              {HEADER_QUICK_LINKS.map((link) => {
                const active =
                  pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-[12px] tracking-wide ${
                      active ? "text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    {t(link.key)}
                  </Link>
                );
              })}
            </nav>
            <LanguageSwitcher variant="light" />
            <Link
              href="/studio/kitchen"
              className="hidden bg-ink px-4 py-2.5 text-[12px] text-paper transition-opacity hover:opacity-80 sm:inline"
            >
              {t("enterStudio")}
            </Link>
            <button
              type="button"
              className="text-[13px] md:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="fixed inset-0 z-40 flex flex-col bg-ink px-[clamp(1.25rem,4vw,2.5rem)] pb-10 pt-24 text-paper md:hidden"
          >
            <nav className="flex flex-1 flex-col justify-center gap-2">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.05 + i * 0.06, duration: 0.45, ease }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="font-display block py-3 text-4xl tracking-tight"
                  >
                    {t(link.key)}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.45, ease }}
              >
                <Link
                  href="/studio/kitchen"
                  onClick={() => setMenuOpen(false)}
                  className="mt-6 inline-block border border-paper px-6 py-3 text-[13px]"
                >
                  {t("enterStudio")} →
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-auto bg-ink py-14 text-paper">
      <div className="px-[clamp(1.25rem,4vw,2.5rem)]">
        <div className="flex flex-col gap-8 border-b border-paper/20 pb-10 sm:flex-row sm:justify-between">
          <div>
            <p className="font-display text-3xl tracking-tight">
              {SHOP.name}
              <span className="align-super text-[0.45em]">®</span>
            </p>
            <p className="mt-2 text-[13px] text-paper/45">{t("atelierMark")}</p>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-paper/65">
              {t("shopTagline")}
            </p>
          </div>
          <div className="flex flex-col gap-3 text-[13px] sm:items-end">
            <Link href="/studio" className="nav-underline hover:opacity-70">
              {t("virtualDesignStudio")}
            </Link>
            <Link href="/gallery" className="nav-underline hover:opacity-70">
              {t("gallery")}
            </Link>
            <Link href="/products" className="nav-underline hover:opacity-70">
              {t("products")}
            </Link>
            <Link href="/admin" className="text-paper/35 hover:text-paper/70">
              {t("admin")}
            </Link>
          </div>
        </div>
        <p className="mt-8 text-[12px] text-paper/35">
          © {new Date().getFullYear()} {SHOP.name} · {t("madeInPakistan")}
        </p>
      </div>
    </footer>
  );
}
