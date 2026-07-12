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
