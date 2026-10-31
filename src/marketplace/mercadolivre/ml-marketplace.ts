import { MarketplaceProvider, MarketplaceProduct, SearchOptions } from '../marketplace.interface';
import { isAuthenticated, refreshAccessToken } from './ml-auth';
import { searchProducts, getItem, getCategories as fetchCategories, getHighResImageUrl, extractItemId, discoverByCategory } from './ml-api';
import { generateAffiliateLink } from './ml-affiliate';
import axios from 'axios';
import { getValidAccessToken } from './ml-auth';

export class MercadoLivreMarketplace implements MarketplaceProvider {
  readonly name = 'mercadolivre';

  async initialize(): Promise<void> {
    if (isAuthenticated()) {
      try {
        await refreshAccessToken();
        console.log('[ML] Marketplace inicializado com sucesso.');
      } catch (err) {
        console.warn('[ML] Falha ao renovar token. Execute: npm run auth:ml');
      }
    } else {
      console.warn('[ML] Sem tokens. Execute: npm run auth:ml');
    }
  }

  async search(options: SearchOptions): Promise<MarketplaceProduct[]> {
    const results = await searchProducts(options);

    return results.map(item => ({
      externalId: item.id,
      marketplace: this.name,
      title: item.title,
      price: item.price,
      originalPrice: item.original_price,
      currency: item.currency_id,
      imageUrl: getHighResImageUrl(item.thumbnail),
      productUrl: item.permalink,
      affiliateUrl: generateAffiliateLink(item.permalink),
      category: item.category_id,
      condition: item.condition,
      soldQuantity: item.sold_quantity,
      freeShipping: item.shipping.free_shipping,
    }));
  }

  async getProduct(externalIdOrUrl: string): Promise<MarketplaceProduct | null> {
    // Check if it's a product catalog URL (/p/MLB...)
    const productMatch = externalIdOrUrl.match(/\/p\/(MLB\d+)/i);
    if (productMatch) {
      return this.getProductFromCatalog(productMatch[1]);
    }

    const itemId = extractItemId(externalIdOrUrl) || externalIdOrUrl;

    try {
      const item = await getItem(itemId);
      const imageUrl = item.pictures?.[0]?.secure_url || getHighResImageUrl(item.thumbnail);

      return {
        externalId: item.id,
        marketplace: this.name,
        title: item.title,
        price: item.price,
        originalPrice: item.original_price,
        currency: item.currency_id,
        imageUrl,
        productUrl: item.permalink,
        affiliateUrl: generateAffiliateLink(item.permalink),
        category: item.category_id,
        condition: item.condition,
        soldQuantity: item.sold_quantity,
        freeShipping: item.shipping.free_shipping,
      };
    } catch {
      return null;
    }
  }

  private async getProductFromCatalog(productId: string): Promise<MarketplaceProduct | null> {
    try {
      const token = await getValidAccessToken();
      const h = { headers: { Authorization: `Bearer ${token}` } };

      const [prodRes, itemsRes] = await Promise.all([
        axios.get(`https://api.mercadolibre.com/products/${productId}`, h),
        axios.get(`https://api.mercadolibre.com/products/${productId}/items`, h),
      ]);

      const prod = prodRes.data;
      const items = itemsRes.data.results;
      if (!items.length) return null;

      const best = items.reduce((a: any, b: any) => a.price < b.price ? a : b);
      const imageUrl = prod.pictures?.[0]?.url || '';
      const productUrl = `https://www.mercadolivre.com.br/p/${productId}`;

      return {
        externalId: best.item_id,
        marketplace: this.name,
        title: prod.name,
        price: best.price,
        originalPrice: best.original_price ?? null,
        currency: best.currency_id || 'BRL',
        imageUrl,
        productUrl,
        affiliateUrl: generateAffiliateLink(productUrl),
        category: best.category_id || '',
        condition: best.condition || 'new',
        soldQuantity: best.sold_quantity ?? 0,
        freeShipping: best.shipping?.free_shipping ?? false,
      };
    } catch {
      return null;
    }
  }

  generateAffiliateLink(productUrl: string): string {
    return generateAffiliateLink(productUrl);
  }

  async getCategories(): Promise<Array<{ id: string; name: string }>> {
    return fetchCategories();
  }

  isAuthenticated(): boolean {
    return isAuthenticated();
  }

  async refreshAuth(): Promise<void> {
    await refreshAccessToken();
  }
}
