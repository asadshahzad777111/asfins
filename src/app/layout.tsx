import type { Metadata } from "next";
import { Libre_Caslon_Text, Hanken_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteChromeGate } from "@/components/SiteChromeGate";
import { SITE } from "@/lib/site";
import "./globals.css";
import "./stitch-atelier.css";

const libreCaslon = Libre_Caslon_Text({
  variable: "--font-libre-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_DESCRIPTION =
  "ASFins — premium architectural materials for Lahore. Laminate sheets, hardware, and surfaces with clear PKR rates. Cart, COD / WhatsApp orders.";

const OG_IMAGE = {
  url: "/marketing/hero-kitchen.webp",
  width: 1600,
  height: 1000,
  alt: "ASFins — premium architectural interiors",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.legalName} — ${SITE.taglineEn}`,
    template: `%s · ${SITE.shortName}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "interior design",
    "laminate",
    "architectural materials",
    "kitchen",
    "Lahore",
    "Pakistan",
    "ASFins",
    "Aspire Interiors",
    "Patex",
    "ZRK",
  ],
  openGraph: {
    siteName: SITE.legalName,
    locale: "en_PK",
    type: "website",
    url: SITE.url,
    title: `${SITE.shortName} · ${SITE.legalName}`,
    description: SITE.taglineEn,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.shortName} · ${SITE.legalName}`,
    description: SITE.taglineEn,
    images: [OG_IMAGE.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${libreCaslon.variable} ${hanken.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <Providers>
          <SiteChromeGate>{children}</SiteChromeGate>
        </Providers>
      </body>
    </html>
  );
}
