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
}

export interface ProductRegistry {
  products: Product[];
}
