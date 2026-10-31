export interface MarketplaceProduct {
  externalId: string;
  marketplace: string;
  title: string;
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
}

export interface SearchOptions {
  query?: string;
  category?: string;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'sold_quantity';
  minDiscount?: number;
  limit?: number;
  offset?: number;
}

export interface MarketplaceProvider {
  readonly name: string;
  initialize(): Promise<void>;
  search(options: SearchOptions): Promise<MarketplaceProduct[]>;
  getProduct(externalId: string): Promise<MarketplaceProduct | null>;
  generateAffiliateLink(productUrl: string): Promise<string>;
  getCategories(): Promise<Array<{ id: string; name: string }>>;
  isAuthenticated(): boolean;
  refreshAuth(): Promise<void>;
}
