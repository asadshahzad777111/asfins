import type { Metadata } from "next";
import { Fraunces, Outfit, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteChromeGate } from "@/components/SiteChromeGate";
import { SITE } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.legalName} — ${SITE.taglineEn}`,
    template: `%s · ${SITE.shortName}`,
  },
  description:
    "Preview floor, walls, cabinets, ceiling & finishes on real room photos — then request a quote from partnered dealers.",
  keywords: [
    "interior design",
    "laminate",
    "flooring",
    "room visualizer",
    "Pakistan",
    "ASFins",
    "Aspire Interiors",
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
      className={`${fraunces.variable} ${outfit.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <Providers>
          <SiteChromeGate>{children}</SiteChromeGate>
        </Providers>
      </body>
    </html>
  );
}
