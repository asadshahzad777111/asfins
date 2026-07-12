import type { Metadata } from "next";
import { AboutPageClient } from "@/components/AboutPageClient";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.legalName} (${SITE.shortName}) — ${SITE.taglineEn}. Colour studio for wood & laminate in ${SITE.city}.`,
};

export default function AboutPage() {
  return <AboutPageClient />;
}
