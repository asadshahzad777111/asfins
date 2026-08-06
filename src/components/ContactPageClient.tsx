"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { QuoteInterestForm } from "@/components/QuoteInterestForm";
import { SHOP } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { whatsappUrl } from "@/lib/share";

const ease = [0.22, 1, 0.36, 1] as const;

export function ContactPageClient() {
  const { t } = useLanguage();
  const waHref = whatsappUrl(t("whatsappPrefill"));

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="px-[clamp(1.25rem,4vw,2.5rem)] pb-28 pt-14 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease }}
          className="max-w-3xl"
        >
          <p className="text-[13px] uppercase tracking-[0.14em] text-muted">
            {t("atelierMark")}
          </p>
          <h1 className="text-heading-lg mt-4">{t("contactTitle")}</h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            {t("contactSubtitle")}
          </p>

          <div className="mt-12 grid gap-10 border-t border-ink pt-10 sm:grid-cols-2">
            <div className="space-y-5">
              <div>
                <p className="text-[12px] uppercase tracking-[0.12em] text-muted">
                  {t("contactWhatsApp")}
                </p>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-underline mt-2 inline-block text-[15px]"
                >
                  {SHOP.whatsapp.startsWith("92")
                    ? `0${SHOP.whatsapp.slice(2)}`
                    : SHOP.whatsapp}{" "}
                  · {t("chatOnWhatsApp")} →
                </a>
              </div>
              {SHOP.email && (
                <div>
                  <p className="text-[12px] uppercase tracking-[0.12em] text-muted">
                    {t("contactEmail")}
                  </p>
                  <a
                    href={`mailto:${SHOP.email}`}
                    className="nav-underline mt-2 inline-block text-[15px]"
                  >
                    {SHOP.email}
                  </a>
                </div>
              )}
              <div>
                <p className="text-[12px] uppercase tracking-[0.12em] text-muted">
                  {SHOP.city}
                </p>
                <p className="mt-2 text-[15px] text-muted">
                  {SHOP.legalName} · {SHOP.name}
                </p>
              </div>
              <Link
                href="/products"
                className="nav-underline inline-block text-[15px]"
              >
                {t("contactStudioCta")} →
              </Link>
            </div>

            <div>
              <p className="mb-5 text-[12px] uppercase tracking-[0.12em] text-muted">
                {t("quoteFormHeading")}
              </p>
              <QuoteInterestForm />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
