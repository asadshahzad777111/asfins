"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useCart } from "@/lib/cart/CartContext";
import { whatsappUrl } from "@/lib/share";

const NAV_LEFT = [
  { href: "/products?filter=sheets", label: "Sheets", match: "sheets" },
  { href: "/products?filter=hardware", label: "Hardware", match: "hardware" },
  { href: "/products?filter=sheets", label: "Surfaces", match: "surfaces" },
  { href: "/gallery", label: "Gallery", match: "gallery" },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

function CartIcon({ count }: { count: number }) {
  return (
    <span className="relative inline-flex">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M6 6h15l-1.5 9h-12z" />
        <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
        <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
        <path d="M6 6L5 3H2" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-ink px-1 text-[10px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </span>
  );
}

export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useCart();
  const wa = whatsappUrl(t("whatsappPrefill"));

  return (
    <>
      <header className="site-header-glass sticky top-0 z-50 text-ink">
        {/* Desktop */}
        <div className="mx-auto hidden max-w-[1440px] items-center justify-between px-8 py-7 md:flex lg:px-16">
          <nav className="flex flex-1 items-center gap-8">
            {NAV_LEFT.map((link) => {
              const active =
                pathname.startsWith("/products") && link.match !== "gallery"
                  ? false
                  : pathname.startsWith(link.href.split("?")[0]!);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`label-caps transition-colors duration-300 ${
                    active
                      ? "text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/"
            className="flex flex-1 justify-center font-display text-[32px] font-bold leading-none tracking-tighter text-ink"
          >
            ASFINS®
          </Link>

          <div className="flex flex-1 items-center justify-end gap-5">
            <LanguageSwitcher variant="light" />
            <Link
              href="/products"
              className="text-ink transition-opacity hover:opacity-70"
              aria-label={t("productsFilter")}
              title={t("productsFilter")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </Link>
            <Link
              href="/cart"
              className="text-ink transition-opacity hover:opacity-70"
              aria-label={t("cartTitle")}
            >
              <CartIcon count={count} />
            </Link>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink transition-opacity hover:opacity-70"
              aria-label={t("chatOnWhatsApp")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <path d="M21 12a8.5 8.5 0 01-12.4 7.5L4 21l1.6-4.4A8.5 8.5 0 1121 12z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-5 py-4 md:hidden">
          <Link
            href="/"
            className="font-display text-[28px] font-bold leading-none tracking-tighter text-ink"
          >
            ASFINS®
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher variant="light" />
            <Link href="/cart" aria-label={t("cartTitle")} className="text-ink">
              <CartIcon count={count} />
            </Link>
            <button
              type="button"
              className="label-caps text-ink"
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
            className="fixed inset-0 z-40 flex flex-col bg-ink px-5 pb-10 pt-24 text-paper md:hidden"
          >
            <nav className="flex flex-1 flex-col justify-center gap-1">
              {[
                ...NAV_LEFT,
                { href: "/about", label: t("about"), match: "about" },
                { href: "/contact", label: t("contact"), match: "contact" },
                { href: "/cart", label: t("cart"), match: "cart" },
              ].map((link, i) => (
                <motion.div
                  key={link.href + link.label}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.45, ease }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="font-display block py-3 text-4xl tracking-tight"
                  >
                    {link.label}
                    {link.match === "cart" && count > 0 ? ` (${count})` : ""}
                  </Link>
                </motion.div>
              ))}
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
  const wa = whatsappUrl(t("whatsappPrefill"));

  return (
    <footer className="mt-auto border-t border-stone bg-[#f3f3f3] pt-20 pb-8 text-ink md:pt-28">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-5 md:grid-cols-3 md:gap-6 md:px-16">
        <div>
          <p className="font-display text-[32px] tracking-tight">ASFins®</p>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
            {t("footerBrandBlurb")}
          </p>
        </div>
        <div>
          <h4 className="label-caps mb-6 text-ink">{t("footerCategories")}</h4>
          <div className="flex flex-col gap-4 text-base text-muted">
            <Link href="/products?filter=sheets" className="hover:text-brass">
              Sheets
            </Link>
            <Link href="/products?filter=hardware" className="hover:text-brass">
              Hardware
            </Link>
            <Link href="/products?filter=sheets" className="hover:text-brass">
              Surfaces
            </Link>
            <span className="text-muted/60">
              Floor <span className="label-caps ml-2 text-brass">Soon</span>
            </span>
            <span className="text-muted/60">
              Decor <span className="label-caps ml-2 text-brass">Soon</span>
            </span>
          </div>
        </div>
        <div>
          <h4 className="label-caps mb-6 text-ink">{t("contact")}</h4>
          <div className="flex flex-col gap-4 text-base text-muted">
            <Link href="/about" className="hover:text-brass">
              {t("about")}
            </Link>
            <Link href="/contact" className="hover:text-brass">
              {SHOP.city}
            </Link>
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brass"
            >
              WhatsApp
            </a>
            <a href={`tel:+${SHOP.whatsapp}`} className="hover:text-brass">
              {t("contactPhone")}
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 flex max-w-[1440px] flex-col items-center justify-between gap-4 border-t border-stone px-5 pt-8 text-sm text-muted md:flex-row md:px-16">
        <p>
          © {year} ASFins®. {t("allRightsReserved")}
        </p>
        <p className="text-xs uppercase tracking-[0.12em]">
          {SHOP.legalName} · {SHOP.city}
        </p>
      </div>
    </footer>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const { t } = useLanguage();

  const items = [
    {
      href: "/products",
      label: "Shop",
      active: pathname.startsWith("/products") || pathname === "/",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M4 7h16v12H4V7zm2-4h12l1 3H5l1-3z" opacity="0.9" />
        </svg>
      ),
    },
    {
      href: "/gallery",
      label: "Gallery",
      active: pathname.startsWith("/gallery"),
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      href: "/cart",
      label: t("cart"),
      active: pathname.startsWith("/cart"),
      icon: <CartIcon count={count} />,
    },
    {
      href: "/products",
      label: "Search",
      active: false,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-stone bg-paper px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            item.active ? "text-ink" : "text-muted"
          }`}
        >
          {item.icon}
          <span className="label-caps text-[10px] tracking-wider">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
