export type ProductStatus = 'pending' | 'posted' | 'skipped' | 'failed';
export type ProductSource = 'auto' | 'manual';

export interface Product {
  id: number;
  externalId: string;
  marketplace: string;
  title: string;
  headline: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  imageUrl: string;
  productUrl: string;
  affiliateUrl: string | null;
  category: string | null;
  condition: string | null;
  soldQuantity: number | null;
  freeShipping: boolean;
  couponCode: string | null;
  source: ProductSource;
  status: ProductStatus;
  addedAt: string;
  postedAt: string | null;
  discountPercent: number | null;
  sortOrder: number;
}
