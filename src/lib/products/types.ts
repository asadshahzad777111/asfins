import type { FinishHintId } from "@/lib/catalogs/finish-hint";
import type { Substrate } from "@/lib/stock";

export interface Product {
  id: string;
  name: string;
  pricePKR: number;
  image: string;
  category: string;
  description: string;
  active: boolean;
  createdAt: string;
  /** ZRK-style sheet product fields */
  productCode?: string;
  surfaceFinish?: string;
  colorDescription?: string;
  dimensions?: string;
  thickness?: string;
  idealApplications?: string;
  brandName?: string;
  technicalSheetUrl?: string;
  /** Series label e.g. UV Lux — mirrors catalog materialCategory */
  materialCategory?: string;
  /** Core board for rate/stock tracks (Lamination Series MDF vs Chipboard) */
  substrate?: Substrate | null;
  /** Units on hand */
  stock?: number;
  /** Stock ≤ this → low stock */
  lowStockAt?: number;
  /** Optional override; otherwise derived from series name */
  finishHint?: FinishHintId;
}

export interface ProductRegistry {
  products: Product[];
}
