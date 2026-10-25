import crypto from 'crypto';
import axios from 'axios';
import { MarketplaceProduct } from '../marketplace.interface';
import { getMarketplaceConfig } from '../../db/marketplace-config.repo';

const SHOPEE_GRAPHQL_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

export interface ShopeeOfferNode {
  itemId?: string;
  productName?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  priceDiscountRate?: number;
  imageUrl?: string;
  offerLink?: string;
  productLink?: string;
  commissionRate?: string | number;
  sales?: number;
  ratingStar?: number;
  shopName?: string;
  shopId?: string;
}

export function isShopeeUrl(url: string): boolean {
  return /shopee\.com\.br|shope\.ee|s\.shopee\.com\.br/i.test(url);
}

export function generateShopeeAuthHeader(appId: string, secret: string, payloadStr: string, timestamp: number): string {
  const factor = `${appId}${timestamp}${payloadStr}${secret}`;
  const signature = crypto.createHash('sha256').update(factor, 'utf8').digest('hex');
  return `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`;
}

export async function executeShopeeGraphQL<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const cfg = getMarketplaceConfig();
  if (!cfg.shopeeAppId || !cfg.shopeeSecret) {
    throw new Error('Shopee Open API não configurada. Preencha o App ID e Secret no painel ou .env');
  }

  const payloadObj: Record<string, unknown> = { query };
  if (variables) payloadObj.variables = variables;

  const payloadStr = JSON.stringify(payloadObj);
  const timestamp = Math.floor(Date.now() / 1000);
  const authHeader = generateShopeeAuthHeader(cfg.shopeeAppId, cfg.shopeeSecret, payloadStr, timestamp);

  const response = await axios.post<{ data?: T; errors?: Array<{ message: string }> }>(
    SHOPEE_GRAPHQL_URL,
    payloadStr,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      timeout: 15000,
    }
  );

  if (response.data.errors && response.data.errors.length > 0) {
    throw new Error(`Shopee GraphQL Error: ${response.data.errors[0].message}`);
  }

  return response.data.data as T;
}

export async function generateShopeeShortLink(originUrl: string, subIds: string[] = ['bot']): Promise<string> {
  const mutation = `
    mutation {
      generateShortLink(input: {
        originUrl: "${originUrl.replace(/"/g, '\\"')}",
        subIds: ${JSON.stringify(subIds)}
      }) {
        shortLink
      }
    }
  `;

  try {
    const data = await executeShopeeGraphQL<{ generateShortLink: { shortLink: string } }>(mutation);
    return data?.generateShortLink?.shortLink || originUrl;
  } catch (err: any) {
    console.warn('[Shopee] Falha ao gerar shortlink via API:', err?.message || err);
    return originUrl;
  }
}

export async function searchShopeeOffers(keyword = '', limit = 20, page = 1): Promise<MarketplaceProduct[]> {
  const query = `
    query {
      productOfferV2(
        ${keyword ? `keyword: "${keyword.replace(/"/g, '\\"')}",` : ''}
        listType: 0,
        sortType: 2,
        page: ${page},
        limit: ${limit}
      ) {
        nodes {
          itemId
          productName
          priceMin
          priceMax
          priceDiscountRate
          imageUrl
          offerLink
          productLink
          commissionRate
          sales
          ratingStar
          shopName
        }
      }
    }
  `;

  const data = await executeShopeeGraphQL<{ productOfferV2: { nodes: ShopeeOfferNode[] } }>(query);
  const nodes = data?.productOfferV2?.nodes || [];

  return nodes.map((node) => {
    const price = Number(node.priceMin) || Number(node.priceMax) || 0;
    const discountRate = Number(node.priceDiscountRate) || 0;
    const originalPrice = discountRate > 0 && price > 0
      ? Math.round((price / (1 - discountRate / 100)) * 100) / 100
      : null;

    return {
      externalId: String(node.itemId || Math.random().toString(36).substring(7)),
      marketplace: 'shopee',
      title: node.productName || 'Produto Shopee',
      price,
      originalPrice,
      currency: 'BRL',
      imageUrl: node.imageUrl || '',
      productUrl: node.productLink || node.offerLink || '',
      affiliateUrl: node.offerLink || null,
      category: 'Shopee Ofertas',
      condition: 'new',
      soldQuantity: Number(node.sales) || null,
      freeShipping: false,
    };
  });
}

export async function resolveShopeeProduct(rawUrl: string): Promise<MarketplaceProduct | null> {
  let targetUrl = rawUrl.trim();

  // 1. If it's a shortened URL (shope.ee or s.shopee.com.br), resolve redirect
  try {
    const headRes = await axios.get(targetUrl, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (headRes.request?.res?.responseUrl) {
      targetUrl = headRes.request.res.responseUrl;
    }
  } catch (err) {
    // Continue with original url if redirect resolution fails
  }

  // 2. Extract item ID and shop ID from URL if present
  // Typical formats:
  // https://shopee.com.br/product/12345/67890
  // https://shopee.com.br/title-i.12345.67890
  let itemId: string | null = null;
  let shopId: string | null = null;

  const matchI = targetUrl.match(/-i\.(\d+)\.(\d+)/);
  if (matchI) {
    shopId = matchI[1];
    itemId = matchI[2];
  } else {
    const matchProd = targetUrl.match(/\/product\/(\d+)\/(\d+)/);
    if (matchProd) {
      shopId = matchProd[1];
      itemId = matchProd[2];
    }
  }

  // 3. Generate affiliate link
  let affiliateUrl: string | null = null;
  try {
    affiliateUrl = await generateShopeeShortLink(targetUrl);
  } catch {}

  // 4. Fetch HTML metadata to extract title, image, price
  try {
    const pageRes = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    const html = pageRes.data as string;

    // Extract OpenGraph tags
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)
      || html.match(/<title>(.*?)<\/title>/i);
    const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);

    let title = titleMatch ? titleMatch[1].replace(/ \| Shopee Brasil$/i, '').trim() : 'Produto Shopee';
    let imageUrl = imageMatch ? imageMatch[1] : '';

    // Extract price from description or JSON-LD
    let price = 0;
    let originalPrice: number | null = null;

    // Look for R$ price in description (ex: Compre ... por R$ 49,90)
    const priceMatch = (descMatch ? descMatch[1] : html).match(/R\$\s*([\d\.,]+)/i);
    if (priceMatch) {
      const cleanNum = priceMatch[1].replace(/\./g, '').replace(',', '.');
      price = parseFloat(cleanNum) || 0;
    }

    // Try schema.org JSON-LD
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs);
    if (jsonLdMatches) {
      for (const m of jsonLdMatches) {
        try {
          const content = m.replace(/<script type="application\/ld\+json">|<\/script>/g, '');
          const data = JSON.parse(content);
          if (data['@type'] === 'Product' || data.offers) {
            if (data.name) title = data.name;
            if (data.image) imageUrl = Array.isArray(data.image) ? data.image[0] : data.image;
            if (data.offers?.price) price = parseFloat(data.offers.price);
            if (data.offers?.highPrice && data.offers?.lowPrice) {
              price = parseFloat(data.offers.lowPrice);
              originalPrice = parseFloat(data.offers.highPrice);
            }
          }
        } catch {}
      }
    }

    const id = itemId || (targetUrl.match(/\/([a-zA-Z0-9_-]+)(?:\?|$)/)?.[1] || Math.random().toString(36).substring(7));

    return {
      externalId: id,
      marketplace: 'shopee',
      title,
      price: price || 0,
      originalPrice,
      currency: 'BRL',
      imageUrl,
      productUrl: targetUrl,
      affiliateUrl: affiliateUrl || targetUrl,
      category: 'Shopee',
      condition: 'new',
      soldQuantity: null,
      freeShipping: true, // Shopee highlighted feature
    };
  } catch (err: any) {
    console.warn('[Shopee] Falha ao extrair metadados da página:', err?.message || err);

    // Fallback if scraping failed but we have IDs
    return {
      externalId: itemId || 'shopee-' + Date.now(),
      marketplace: 'shopee',
      title: 'Produto Shopee',
      price: 0,
      originalPrice: null,
      currency: 'BRL',
      imageUrl: '',
      productUrl: targetUrl,
      affiliateUrl: affiliateUrl || targetUrl,
      category: 'Shopee',
      condition: 'new',
      soldQuantity: null,
      freeShipping: true,
    };
  }
}
