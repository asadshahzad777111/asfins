import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteChromeGate } from "@/components/SiteChromeGate";
import { SITE } from "@/lib/site";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_DESCRIPTION =
  "ASFins — laminate sheets and kitchen accessories with clear PKR rates. Cart, COD / WhatsApp orders in Lahore.";

const OG_IMAGE = {
  url: "/scenes/kitchen-modern/base.jpg",
  width: 1600,
  height: 1000,
  alt: "ASFins — colour studio kitchen preview",
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
    "kitchen visualizer",
    "wood colour",
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
      className={`${syne.variable} ${dmSans.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <Providers>
          <SiteChromeGate>{children}</SiteChromeGate>
        </Providers>
      </body>
    </html>
  );
}
