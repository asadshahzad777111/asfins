/** Central site config — asfins.com production */
export const SITE = {
  shortName: "ASFins",
  displayName: "ASFins",
  legalName: "Aspire Interiors",
  tagline: "Har finish, ek room mein",
  taglineEn: "Every finish, one room",
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
