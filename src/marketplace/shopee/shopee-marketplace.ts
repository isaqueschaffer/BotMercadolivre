import {
  MarketplaceProduct,
  MarketplaceProvider,
  SearchOptions,
} from '../marketplace.interface';
import {
  isShopeeUrl,
  resolveShopeeProduct,
  searchShopeeOffers,
  generateShopeeShortLink,
} from './shopee-api';
import { getMarketplaceConfig } from '../../db/marketplace-config.repo';

export class ShopeeMarketplace implements MarketplaceProvider {
  readonly name = 'shopee';

  async initialize(): Promise<void> {
    const cfg = getMarketplaceConfig();
    if (cfg.shopeeAppId && cfg.shopeeSecret) {
      console.log('[Shopee] Marketplace inicializado (App ID configurado).');
    } else {
      console.log('[Shopee] Marketplace inicializado (Modo manual ativo - configure App ID e Secret no painel para busca automática).');
    }
  }

  async search(options: SearchOptions): Promise<MarketplaceProduct[]> {
    try {
      return await searchShopeeOffers(options.query || '', options.limit || 20);
    } catch (err: any) {
      console.warn('[Shopee] Falha na busca de ofertas:', err?.message || err);
      return [];
    }
  }

  async getProduct(externalIdOrUrl: string): Promise<MarketplaceProduct | null> {
    if (isShopeeUrl(externalIdOrUrl) || externalIdOrUrl.startsWith('http')) {
      return await resolveShopeeProduct(externalIdOrUrl);
    }

    // If externalId given, search for it
    const results = await searchShopeeOffers(externalIdOrUrl, 1);
    return results[0] || null;
  }

  generateAffiliateLink(productUrl: string): string {
    // Synchronous signature placeholder; async short link generation handled during getProduct
    return productUrl;
  }

  async getCategories(): Promise<Array<{ id: string; name: string }>> {
    return [
      { id: 'shopee_eletronicos', name: 'Eletrônicos e Acessórios' },
      { id: 'shopee_moda', name: 'Roupas e Moda' },
      { id: 'shopee_casa', name: 'Casa e Decoração' },
      { id: 'shopee_beleza', name: 'Beleza e Saúde' },
      { id: 'shopee_informatica', name: 'Computadores e Informática' },
      { id: 'shopee_jogos', name: 'Games e Brinquedos' },
      { id: 'shopee_automotivo', name: 'Automotivo' },
    ];
  }

  isAuthenticated(): boolean {
    const cfg = getMarketplaceConfig();
    return Boolean(cfg.shopeeAppId && cfg.shopeeSecret);
  }

  async refreshAuth(): Promise<void> {
    // Shopee uses per-request HMAC-SHA256 signature, no session token renewal required
  }
}
