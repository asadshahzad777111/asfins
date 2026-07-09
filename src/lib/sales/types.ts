export interface Sale {
  id: string;
  customerName: string;
  productName: string;
  amountPKR: number;
  status: "pending" | "completed" | "cancelled";
  notes: string;
  createdAt: string;
}

export interface SaleRegistry {
  sales: Sale[];
}
