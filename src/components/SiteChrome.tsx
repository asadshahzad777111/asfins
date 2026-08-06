"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useCart } from "@/lib/cart/CartContext";

const NAV_LINKS = [
  { href: "/products", key: "products" as const },
  { href: "/about", key: "about" as const },
  { href: "/contact", key: "contact" as const },
];

const ease = [0.22, 1, 0.36, 1] as const;

export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useCart();

  return (
    <>
      <header className="site-header-glass sticky top-0 z-50 text-ink">
        <div className="flex items-center gap-3 px-[clamp(1.25rem,4vw,2.5rem)] py-4 sm:gap-4">
          <Link href="/" className="flex shrink-0 flex-col">
            <p className="font-display text-lg leading-none tracking-tight sm:text-xl">
              {SHOP.name}
              <span className="align-super text-[0.5em]">®</span>
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
              {SHOP.legalName} · {SHOP.city}
            </p>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
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
            <LanguageSwitcher variant="light" />
            <Link
              href="/cart"
              className="relative text-[13px] text-ink"
              aria-label={t("cartTitle")}
            >
              {t("cart")}
              {count > 0 && (
                <span className="ml-1 font-mono-data text-[11px] text-brass">
                  ({count})
                </span>
              )}
            </Link>
            <Link
              href="/products"
              className="hidden bg-ink px-4 py-2.5 text-[12px] text-paper transition-opacity hover:opacity-80 sm:inline"
            >
              {t("browseShop")}
            </Link>
            <button
              type="button"
              className="text-[13px] lg:hidden"
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
            className="fixed inset-0 z-40 flex flex-col bg-ink px-[clamp(1.25rem,4vw,2.5rem)] pb-10 pt-24 text-paper lg:hidden"
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
                transition={{ delay: 0.25, duration: 0.45, ease }}
              >
                <Link
                  href="/cart"
                  onClick={() => setMenuOpen(false)}
                  className="font-display block py-3 text-4xl tracking-tight"
                >
                  {t("cart")}
                  {count > 0 ? ` (${count})` : ""}
                </Link>
              </motion.div>
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.45, ease }}
              >
                <Link
                  href="/products"
                  onClick={() => setMenuOpen(false)}
                  className="mt-6 inline-block border border-paper px-6 py-3 text-[13px]"
                >
                  {t("browseShop")} →
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
  const year = new Date().getFullYear();

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
            <Link href="/products" className="nav-underline hover:opacity-70">
              {t("products")}
            </Link>
            <Link href="/cart" className="nav-underline hover:opacity-70">
              {t("cart")}
            </Link>
            <Link href="/about" className="nav-underline hover:opacity-70">
              {t("about")}
            </Link>
            <Link href="/contact" className="nav-underline hover:opacity-70">
              {t("contact")}
            </Link>
          </div>
        </div>
        <p className="mt-8 text-[12px] text-paper/35">
          © {year} {SHOP.name} · {SHOP.legalName} · {SHOP.city} · {t("madeInPakistan")}
        </p>
      </div>
    </footer>
  );
}
