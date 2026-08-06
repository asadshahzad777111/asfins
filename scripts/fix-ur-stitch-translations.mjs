import fs from "fs";

const path = "D:/Projects/color-configurator/src/lib/i18n/translations.ts";
const out = "D:/Projects/color-configurator/src/lib/i18n/translations.ts.new";
let s = fs.readFileSync(path, "utf8");

const urInsert = `    shopSheets: "Sheets shop karein",
    browseHardware: "Hardware dekhein",
    exploreCollections: "Collections explore karein",
    bookConsultation: "Consultation book karein",
    curatedCollections: "Curated Collections",
    comingSoon: "Jald aa raha hai",
    homeHeroTitle: "Finish, before you build.",
    homeHeroSubtitle: "Lahore ke finest interiors ke liye premium architectural materials.",
    homeHeroSubtitleMobile:
      "Curated architectural surfaces aur hardware — uncompromising designers ke liye.",
    philosophyLabel: "Philosophy",
    philosophyBody:
      "Hum materials ki weight pe believe karte hain. Har finish ek foundational decision hai.",
    footerBrandBlurb:
      "Lahore ke interiors ko meticulous material selection aur quality se elevate karte hain.",
    footerCategories: "Categories",
    contactPhone: "Phone",
    allRightsReserved: "All rights reserved.",
    lahoreDepotRate: "Lahore Depot Rate",
    availability: "Availability",
    orderSummary: "Order Summary",
    deliveryDetails: "Delivery Details",
    shippingTbd: "Shipping (order ke baad calculate)",
    totalEstimated: "Total Estimated",
    paymentMethod: "Payment Method",
    optional: "Optional",
    orderNotePlaceholder:
      "Delivery ya showroom pickup ke liye specific instructions…",
`;

const marker = "  ur: {\n    gallery:";
if (!s.includes("ur: {\n    gallery:")) {
  console.error("marker not found");
  process.exit(1);
}
if (s.includes("    homeHeroTitle:") && s.indexOf("homeHeroTitle") < s.indexOf("  ur:")) {
  // only en has it
} 
if (s.includes("  ur: {\n    gallery:") && !s.includes("  ur: {\n    gallery: \"Gallery\",\n    products:")) {
  // fine
}

// Insert after ur: { line if homeHeroTitle missing in ur block
const urStart = s.indexOf("  ur: {");
const urEnd = s.indexOf("\n  },\n} as const;", urStart);
const urBlock = s.slice(urStart, urEnd);
if (urBlock.includes("homeHeroTitle:")) {
  console.log("ur already has stitch keys");
  process.exit(0);
}

const insertAt = s.indexOf("    gallery: \"Gallery\",", urStart);
const before = s.slice(0, insertAt);
const after = s.slice(insertAt);
s = before + urInsert + after;

fs.writeFileSync(out, s);
console.log("wrote", out);
