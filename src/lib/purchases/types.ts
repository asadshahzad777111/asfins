export interface Purchase {
  id: string;
  supplierName: string;
  itemName: string;
  amountPKR: number;
  status: "ordered" | "received" | "cancelled";
  notes: string;
  createdAt: string;
}

export interface PurchaseRegistry {
  purchases: Purchase[];
}
