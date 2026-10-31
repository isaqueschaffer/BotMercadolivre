import axios, { AxiosRequestConfig } from 'axios';
import { getValidAccessToken } from './ml-auth';
import { SearchOptions } from '../marketplace.interface';

const BASE_URL = 'https://api.mercadolibre.com';

async function authHeaders(): Promise<AxiosRequestConfig> {
  try {
    const token = await getValidAccessToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  } catch {
    return {};
  }
}

export interface MLSearchResult {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  thumbnail: string;
  permalink: string;
  condition: string;
  sold_quantity: number;
  available_quantity: number;
  shipping: { free_shipping: boolean };
  category_id: string;
}

interface MLSearchResponse {
  results: MLSearchResult[];
  paging: { total: number; offset: number; limit: number };
}

export interface MLItemResponse {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  thumbnail: string;
  permalink: string;
  condition: string;
  sold_quantity: number;
  available_quantity: number;
  shipping: { free_shipping: boolean };
  category_id: string;
  pictures: Array<{ url: string; secure_url: string }>;
}

interface MLProductItem {
  item_id: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  category_id: string;
  condition: string;
  listing_type_id: string;
  shipping: { free_shipping: boolean } | null;
  sold_quantity: number;
  deal_ids: string[];
  official_store_id: number | null;
  tags: string[];
}

interface MLProduct {
  id: string;
  name: string;
  permalink: string;
  pictures: Array<{ url: string }>;
  buy_box_winner: { item_id: string; price: number } | null;
}

interface MLHighlightContent {
  id: string;
  position: number;
  type: string;
}

export interface DiscoveredProduct {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string;
  productUrl: string;
  freeShipping: boolean;
  soldQuantity: number;
  category: string;
}

const SORT_MAP: Record<string, string> = {
  relevance: 'relevance',
  price_asc: 'price_asc',
  price_desc: 'price_desc',
  sold_quantity: 'sold_quantity_desc',
};

export async function searchProducts(options: SearchOptions): Promise<MLSearchResult[]> {
  const auth = await authHeaders();

  try {
    const params: Record<string, string | number> = {
      limit: options.limit || 20,
      offset: options.offset || 0,
    };
    if (options.query) params.q = options.query;
    if (options.category) params.category = options.category;
    if (options.sortBy) params.sort = SORT_MAP[options.sortBy] || 'relevance';

    const { data } = await axios.get<MLSearchResponse>(`${BASE_URL}/sites/MLB/search`, { params, ...auth });

    let results = data.results;
    if (options.minDiscount && options.minDiscount > 0) {
      results = results.filter(item => {
        if (!item.original_price || item.original_price <= item.price) return false;
        const discount = ((item.original_price - item.price) / item.original_price) * 100;
        return discount >= (options.minDiscount || 0);
      });
    }
    return results;
  } catch {
    // Search API blocked — fallback to category highlights
    if (options.category) {
      return discoverByCategory(options.category, options.limit || 20)
        .then(items => items.map(toSearchResult));
    }
    return [];
  }
}

function toSearchResult(p: DiscoveredProduct): MLSearchResult {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    original_price: p.originalPrice,
    currency_id: 'BRL',
    thumbnail: p.imageUrl,
    permalink: p.productUrl,
    condition: 'new',
    sold_quantity: p.soldQuantity,
    available_quantity: 1,
    shipping: { free_shipping: p.freeShipping },
    category_id: p.category,
  };
}

export async function getItem(itemId: string): Promise<MLItemResponse> {
  const auth = await authHeaders();
  const { data } = await axios.get<MLItemResponse>(`${BASE_URL}/items/${itemId}`, auth);
  return data;
}

/** Endpoint de debug temporário — retorna o JSON crú da API de preços do ML pra inspeção. */
export async function getItemPricesRaw(itemId: string): Promise<any> {
  const auth = await authHeaders();
  const { data } = await axios.get(`${BASE_URL}/items/${itemId}/prices`, auth);
  return data;
}

export async function getCategories(): Promise<Array<{ id: string; name: string }>> {
  const auth = await authHeaders();
  const { data } = await axios.get<Array<{ id: string; name: string }>>(
    `${BASE_URL}/sites/MLB/categories`, auth
  );
  return data;
}

const subcategoriesCache = new Map<string, Array<{ id: string; name: string }>>();

export async function getSubcategories(categoryId: string): Promise<Array<{ id: string; name: string }>> {
  if (subcategoriesCache.has(categoryId)) {
    return subcategoriesCache.get(categoryId)!;
  }
  try {
    const auth = await authHeaders();
    const { data } = await axios.get<{ children_categories?: Array<{ id: string; name: string }> }>(
      `${BASE_URL}/categories/${categoryId}`, auth
    );
    const children = data.children_categories || [];
    subcategoriesCache.set(categoryId, children);
    return children;
  } catch {
    return [];
  }
}

const topLevelNameCache = new Map<string, string | null>();

/** Resolve uma categoria (de qualquer nível) para o nome da categoria raiz, usada para casar com cupons. */
export async function getTopLevelCategoryName(categoryId: string): Promise<string | null> {
  if (topLevelNameCache.has(categoryId)) return topLevelNameCache.get(categoryId)!;

  try {
    const auth = await authHeaders();
    const { data } = await axios.get<{ path_from_root?: Array<{ id: string; name: string }> }>(
      `${BASE_URL}/categories/${categoryId}`, auth
    );
    const name = data.path_from_root?.[0]?.name || null;
    topLevelNameCache.set(categoryId, name);
    return name;
  } catch {
    topLevelNameCache.set(categoryId, null);
    return null;
  }
}

export async function getTrends(): Promise<Array<{ keyword: string; url: string }>> {
  const auth = await authHeaders();
  const { data } = await axios.get<Array<{ keyword: string; url: string }>>(
    `${BASE_URL}/trends/MLB`, auth
  );
  return data;
}

export async function discoverByCategory(categoryId: string, limit = 20): Promise<DiscoveredProduct[]> {
  const auth = await authHeaders();

  const { data: highlights } = await axios.get<{ content: MLHighlightContent[] }>(
    `${BASE_URL}/highlights/MLB/category/${categoryId}`, auth
  );

  const productIds = highlights.content
    .filter(c => c.type === 'PRODUCT')
    .slice(0, limit)
    .map(c => c.id);

  if (!productIds.length) return [];

  const products: DiscoveredProduct[] = [];

  const batchSize = 5;
  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (pid) => {
        const [prodRes, itemsRes] = await Promise.all([
          axios.get<MLProduct>(`${BASE_URL}/products/${pid}`, auth),
          axios.get<{ results: MLProductItem[] }>(`${BASE_URL}/products/${pid}/items`, auth),
        ]);

        const prod = prodRes.data;
        const items = itemsRes.data.results;
        if (!items.length) return null;

        const best = items.reduce((a, b) => a.price < b.price ? a : b);
        const imageUrl = prod.pictures?.[0]?.url || '';
        const productUrl = prod.permalink || `https://www.mercadolivre.com.br/p/${pid}`;

        return {
          id: best.item_id,
          title: prod.name,
          price: best.price,
          originalPrice: best.original_price ?? null,
          imageUrl,
          productUrl,
          freeShipping: best.shipping?.free_shipping ?? false,
          soldQuantity: best.sold_quantity ?? 0,
          category: best.category_id || categoryId,
        };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) products.push(r.value);
    }
  }

  return products;
}

export function extractItemId(url: string): string | null {
  const match = url.match(/ML[BU]-?\d+/i);
  if (match) return match[0].replace('-', '');

  const idMatch = url.match(/\/p\/(ML[BU]\d+)/i);
  if (idMatch) return idMatch[1];

  return null;
}

export function getHighResImageUrl(thumbnailUrl: string): string {
  return thumbnailUrl.replace(/-[A-Z]\.jpg$/, '-O.jpg');
}
