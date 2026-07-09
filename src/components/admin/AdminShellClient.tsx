"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import "./admin-wp.css";

const NAV_ITEMS = [
  { href: "/admin/scenes", key: "tabScenes" as const, section: "content" },
  { href: "/admin/catalogs", key: "tabCatalogs" as const, section: "content" },
  { href: "/admin/products", key: "tabProducts" as const, section: "shop" },
  { href: "/admin/sales", key: "tabSales" as const, section: "shop" },
  { href: "/admin/purchases", key: "tabPurchases" as const, section: "shop" },
  { href: "/admin/inquiries", key: "tabInquiries" as const, section: "content" },
];

export function AdminShellClient({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("wp-admin-nav-open", menuOpen);
    return () => document.body.classList.remove("wp-admin-nav-open");
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const contentNav = NAV_ITEMS.filter((n) => n.section === "content");
  const shopNav = NAV_ITEMS.filter((n) => n.section === "shop");

  return (
    <div className="app app--admin">
      <main className="app-main app-main--admin">
        <div className="wp-admin-shell">
          <header className="wp-admin-bar">
            <div className="wp-admin-bar-left">
              <button
                type="button"
                className="wp-admin-menu-toggle"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                Menu
              </button>
              <span className="wp-admin-bar-site">{t("colorVisualizer")}</span>
              <span className="wp-admin-bar-live">Live</span>
              <Link href="/gallery" className="wp-admin-bar-link" target="_blank">
                {t("viewSite")}
              </Link>
            </div>
            <div className="wp-admin-bar-right">
              <LanguageSwitcher />
              <span className="wp-admin-bar-user">{t("adminPanel")}</span>
              <LogoutButton className="wp-admin-bar-link" />
            </div>
          </header>

          <div className="wp-admin-frame">
            <aside className={`wp-admin-menu${menuOpen ? " is-open" : ""}`} id="wp-admin-menu">
              <div className="wp-menu-section">
                {contentNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`wp-menu-link${pathname === item.href ? " is-active" : ""}`}
                  >
                    <span>{t(item.key)}</span>
                  </Link>
                ))}
              </div>
              <div className="wp-menu-section">
                <p className="wp-menu-heading">{t("tabShopSection")}</p>
                {shopNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`wp-menu-link${pathname === item.href ? " is-active" : ""}`}
                  >
                    <span>{t(item.key)}</span>
                  </Link>
                ))}
              </div>
            </aside>

            <main className="wp-admin-content">
              <div className="wp-admin-content-head">
                <h1 className="wp-admin-page-title">
                  {t(NAV_ITEMS.find((n) => n.href === pathname)?.key ?? "adminPanel")}
                </h1>
              </div>
              {children}
            </main>
          </div>
        </div>
      </main>
    </div>
  );
}
