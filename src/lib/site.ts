/** Central site config — asfins.com production */
export const SITE = {
  shortName: "ASFins",
  displayName: "ASFins",
  legalName: "Aspire Interiors",
  tagline: "Colour, banane se pehle",
  taglineEn: "Colour, before you build",
  domain: "asfins.com",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://asfins.com",
  city: "Lahore",
  country: "Pakistan",
  whatsapp:
    process.env.NEXT_PUBLIC_WHATSAPP?.replace(/\D/g, "") ?? "923001234567",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@asfins.com",
  founder: "Asad Shahzad",
  parentShop: "ASPLY",
} as const;
