export type OrderStatus = "new" | "confirmed" | "done" | "cancelled";

export interface OrderLineItem {
  productId: string;
  name: string;
  pricePKR: number;
  qty: number;
  image?: string;
  category?: string;
}

export interface ShopOrder {
  id: string;
  /** Human-friendly e.g. ASF-1001 */
  orderNumber: string;
  name: string;
  phone: string;
  city?: string;
  note?: string;
  paymentMethod: "cod";
  items: OrderLineItem[];
  totalPKR: number;
  status: OrderStatus;
  stockDecremented?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderRegistry {
  orders: ShopOrder[];
}
