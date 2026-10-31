import { getNextPending, updateProductStatus, updateAffiliateUrl } from '../db/products.repo';
import { MarketplaceProvider } from '../marketplace/marketplace.interface';
import { Product } from '../types/product';

export function pickNextProduct(): Product | null {
  return getNextPending();
}

export function ensureAffiliateLink(product: Product, marketplace: MarketplaceProvider): Product {
  if (!product.affiliateUrl) {
    const affiliateUrl = marketplace.generateAffiliateLink(product.productUrl);
    updateAffiliateUrl(product.id, affiliateUrl);
    return { ...product, affiliateUrl };
  }
  return product;
}

export function markPosted(productId: number): void {
  updateProductStatus(productId, 'posted');
}

export function markFailed(productId: number): void {
  updateProductStatus(productId, 'failed');
}
