import type { Metadata } from "next";
import { ContactPageClient } from "@/components/ContactPageClient";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Reach ${SITE.shortName} / ${SITE.legalName} in ${SITE.city} — WhatsApp, email, or request a quote.`,
};

export default function ContactPage() {
  return <ContactPageClient />;
}
