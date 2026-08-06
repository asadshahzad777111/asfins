/** Shop product categories — sheets + kitchen accessories */

export const PRODUCT_CATEGORY_IDS = [
  "wood-laminate",
  "marble",
  "handles",
  "hardware",
  "organizers",
  "sinks",
  "accessories",
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORY_IDS)[number];

export type ShopFilterId =
  | "all"
  | "sheets"
  | "handles"
  | "hardware"
  | "organizers"
  | "sinks"
  | "accessories";

export const SHOP_FILTERS: { id: ShopFilterId; labelKey: ShopFilterLabelKey }[] = [
  { id: "all", labelKey: "filterAll" },
  { id: "sheets", labelKey: "filterSheets" },
  { id: "handles", labelKey: "filterHandles" },
  { id: "hardware", labelKey: "filterHardware" },
  { id: "organizers", labelKey: "filterOrganizers" },
  { id: "sinks", labelKey: "filterSinks" },
  { id: "accessories", labelKey: "filterAccessories" },
];

export type ShopFilterLabelKey =
  | "filterAll"
  | "filterSheets"
  | "filterHandles"
  | "filterHardware"
  | "filterOrganizers"
  | "filterSinks"
  | "filterAccessories";

/** Admin select options (value stored on Product.category) */
export const ADMIN_CATEGORY_OPTIONS: {
  id: ProductCategoryId;
  labelKey: ShopFilterLabelKey;
}[] = [
  { id: "wood-laminate", labelKey: "filterSheets" },
  { id: "marble", labelKey: "filterSheets" },
  { id: "handles", labelKey: "filterHandles" },
  { id: "hardware", labelKey: "filterHardware" },
  { id: "organizers", labelKey: "filterOrganizers" },
  { id: "sinks", labelKey: "filterSinks" },
  { id: "accessories", labelKey: "filterAccessories" },
];

const SHEET_CATEGORIES = new Set(["wood-laminate", "marble", "sheets"]);

export function isSheetCategory(category: string): boolean {
  return SHEET_CATEGORIES.has(category.toLowerCase());
}

export function productMatchesShopFilter(
  category: string,
  filter: ShopFilterId
): boolean {
  if (filter === "all") return true;
  const cat = category.toLowerCase().trim();
  if (filter === "sheets") return isSheetCategory(cat);
  return cat === filter;
}

export function unitLabelForCategory(category: string): "perSheet" | "each" {
  return isSheetCategory(category) ? "perSheet" : "each";
}
