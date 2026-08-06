export type Substrate = "mdf" | "chipboard";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export const DEFAULT_STOCK = 48;
export const DEFAULT_LOW_STOCK_AT = 10;

export function getStockStatus(
  stock: number | undefined | null,
  lowStockAt: number | undefined | null = DEFAULT_LOW_STOCK_AT
): StockStatus {
  const qty = stock ?? 0;
  const threshold = lowStockAt ?? DEFAULT_LOW_STOCK_AT;
  if (qty <= 0) return "out_of_stock";
  if (qty <= threshold) return "low_stock";
  return "in_stock";
}

export function stockStatusLabelKey(
  status: StockStatus
): "inStock" | "lowStock" | "outOfStock" {
  if (status === "out_of_stock") return "outOfStock";
  if (status === "low_stock") return "lowStock";
  return "inStock";
}

/** Sort key: in-stock / low-stock / unknown first; out-of-stock last. */
export function stockSortRank(
  stock: number | undefined | null,
  lowStockAt: number | undefined | null = DEFAULT_LOW_STOCK_AT
): number {
  // Missing stock → treat as available (don't bury products without qty set)
  if (stock == null) return 0;
  return getStockStatus(stock, lowStockAt) === "out_of_stock" ? 1 : 0;
}

export function compareByStockAvailability<
  T extends { stock?: number | null; lowStockAt?: number | null },
>(a: T, b: T): number {
  return stockSortRank(a.stock, a.lowStockAt) - stockSortRank(b.stock, b.lowStockAt);
}
