import { MarketplaceProduct, MarketplaceProvider } from './marketplace.interface';
import { MercadoLivreMarketplace } from './mercadolivre/ml-marketplace';
import { ShopeeMarketplace } from './shopee/shopee-marketplace';
import { isShopeeUrl } from './shopee/shopee-api';

export class MarketplaceManager {
  private providers: Map<string, MarketplaceProvider> = new Map();

  constructor() {
    this.register(new MercadoLivreMarketplace());
    this.register(new ShopeeMarketplace());
  }

  register(provider: MarketplaceProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): MarketplaceProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): MarketplaceProvider[] {
    return Array.from(this.providers.values());
  }

  async initializeAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.initialize();
      } catch (err: any) {
        console.error(`[Marketplace] Erro ao inicializar ${provider.name}:`, err?.message || err);
      }
    }
  }

  detectProviderForUrl(url: string): MarketplaceProvider {
    if (isShopeeUrl(url)) {
      return this.providers.get('shopee')!;
    }

    // Default to Mercado Livre
    return this.providers.get('mercadolivre')!;
  }

  async getProductFromAny(urlOrId: string, marketplaceName?: string): Promise<MarketplaceProduct | null> {
    let provider: MarketplaceProvider | undefined;

    if (marketplaceName && this.providers.has(marketplaceName)) {
      provider = this.providers.get(marketplaceName);
    } else {
      provider = this.detectProviderForUrl(urlOrId);
    }

    if (!provider) {
      provider = this.providers.get('mercadolivre');
    }

    return await provider!.getProduct(urlOrId);
  }
}

export const marketplaceManager = new MarketplaceManager();
