import { MarketplaceProvider } from '../marketplace/marketplace.interface';
import { insertProduct, productExists } from '../db/products.repo';
import { generateHeadline } from './headline-generator';

export async function fetchByQuery(marketplace: MarketplaceProvider, query: string): Promise<number> {
  console.log(`[Fetcher] Buscando "${query}" em ${marketplace.name}...`);

  const products = await marketplace.search({
    query,
    sortBy: 'sold_quantity',
    limit: 20,
  });

  let added = 0;
  for (const product of products) {
    if (productExists(product.externalId, product.marketplace)) continue;

    const headline = await generateHeadline(product.title, product.category);

    insertProduct({
      externalId: product.externalId,
      marketplace: product.marketplace,
      title: product.title,
      headline,
      price: product.price,
      originalPrice: product.originalPrice,
      currency: product.currency,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      affiliateUrl: product.affiliateUrl,
      category: product.category,
      condition: product.condition,
      soldQuantity: product.soldQuantity,
      freeShipping: product.freeShipping,
      couponCode: null,
      source: 'auto',
      discountPercent: null,
    });
    added++;
  }

  console.log(`[Fetcher] ${added} novos produtos de "${query}" adicionados.`);
  return added;
}
