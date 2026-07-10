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

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.legalName} — ${SITE.taglineEn}`,
    template: `%s · ${SITE.shortName}`,
  },
  description:
    "ASFins colour studio — preview wood & laminate on real kitchen photos in Lahore. Patex, ZRK and partner catalogs, then request a dealer quote.",
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
    title: SITE.legalName,
    description: SITE.taglineEn,
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
