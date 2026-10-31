import { getAutoDiscoveryConfig } from '../db/auto-discovery.repo';
import { insertProduct, productExists } from '../db/products.repo';
import { discoverByCategory, getSubcategories, DiscoveredProduct } from '../marketplace/mercadolivre/ml-api';
import { generateHeadline } from './headline-generator';
import { tryAttachPoolCoupon } from './coupon-sync';

const POPULAR_CATEGORIES = [
  'MLB1648', // Informática
  'MLB1051', // Celulares e Telefones
  'MLB1000', // Eletrônicos, Áudio e Vídeo
  'MLB1574', // Casa, Móveis e Decoração
  'MLB1276', // Esportes e Fitness
  'MLB1144', // Games
  'MLB1168', // Brinquedos e Hobbies
  'MLB1246', // Beleza e Cuidado Pessoal
  'MLB1196', // Alimentos e Bebidas
  'MLB1039', // Câmeras e Acessórios
];

let timer: ReturnType<typeof setInterval> | null = null;
let lastRunCategories: string[] = [];
let categoryRotationIndex = 0;

async function getSearchPool(baseCategories: string[]): Promise<string[]> {
  const pool: string[] = [];
  for (const catId of baseCategories) {
    pool.push(catId);
    try {
      const subs = await getSubcategories(catId);
      for (const s of subs) {
        pool.push(s.id);
      }
    } catch {}
  }
  return pool.length > 0 ? pool : baseCategories;
}

function scoreProduct(product: DiscoveredProduct, minDiscount: number): number {
  let score = 0;

  if (product.originalPrice && product.originalPrice > product.price) {
    const discount = ((product.originalPrice - product.price) / product.originalPrice) * 100;
    if (discount < minDiscount) return -1;
    score += discount * 2;
  } else if (minDiscount > 0) {
    return -1;
  }

  if (product.freeShipping) score += 15;
  if (product.soldQuantity > 100) score += 10;
  else if (product.soldQuantity > 10) score += 5;

  return score;
}

async function runDiscovery(force = false): Promise<number> {
  const config = getAutoDiscoveryConfig();
  if (!config.enabled && !force) return 0;

  console.log('[AutoDiscovery] Iniciando busca automática...');

  const baseCategories = config.categories.length > 0
    ? config.categories
    : POPULAR_CATEGORIES;

  const categoriesToSearch = await getSearchPool(baseCategories);

  const batchSize = 4;
  const startIdx = categoryRotationIndex % categoriesToSearch.length;
  const selectedCategories: string[] = [];
  for (let i = 0; i < batchSize && i < categoriesToSearch.length; i++) {
    selectedCategories.push(categoriesToSearch[(startIdx + i) % categoriesToSearch.length]);
  }
  categoryRotationIndex = (startIdx + batchSize) % categoriesToSearch.length;

  let allProducts: DiscoveredProduct[] = [];

  for (const catId of selectedCategories) {
    try {
      const products = await discoverByCategory(catId, 20);
      allProducts.push(...products);
      console.log(`[AutoDiscovery] Categoria ${catId}: ${products.length} produtos encontrados`);
    } catch (err) {
      console.error(`[AutoDiscovery] Erro na categoria ${catId}:`, err);
    }
  }

  const scored = allProducts
    .map(p => ({ product: p, score: scoreProduct(p, config.minDiscount) }))
    .filter(s => s.score >= 0);

  let filtered = scored;

  if (config.freeShippingOnly) {
    filtered = filtered.filter(s => s.product.freeShipping);
  }

  if (config.maxPrice) {
    filtered = filtered.filter(s => s.product.price <= config.maxPrice!);
  }

  filtered.sort((a, b) => b.score - a.score);

  let added = 0;
  for (const { product } of filtered) {
    if (added >= config.maxProductsPerRun) break;
    if (productExists(product.id, 'mercadolivre')) continue;

    const discount = product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

    const headline = await generateHeadline(product.title, product.category);

    const productId = insertProduct({
      externalId: product.id,
      marketplace: 'mercadolivre',
      title: product.title,
      headline,
      price: product.price,
      originalPrice: product.originalPrice,
      currency: 'BRL',
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      affiliateUrl: null,
      category: product.category,
      condition: 'new',
      soldQuantity: product.soldQuantity,
      freeShipping: product.freeShipping,
      couponCode: null,
      source: 'auto',
      discountPercent: discount,
    });
    await tryAttachPoolCoupon(productId, 'mercadolivre', product.category).catch(() => {});
    added++;
  }

  lastRunCategories = selectedCategories;
  console.log(`[AutoDiscovery] ${added} produtos adicionados à fila (de ${allProducts.length} analisados).`);
  return added;
}

export function startAutoDiscovery(): void {
  stopAutoDiscovery();

  const config = getAutoDiscoveryConfig();
  if (!config.enabled) {
    console.log('[AutoDiscovery] Desabilitado.');
    return;
  }

  const intervalMs = config.intervalMinutes * 60 * 1000;

  console.log(`[AutoDiscovery] Ativado. Intervalo: ${config.intervalMinutes}min`);

  runDiscovery().catch(err => console.error('[AutoDiscovery] Erro na execução inicial:', err));

  timer = setInterval(() => {
    runDiscovery().catch(err => console.error('[AutoDiscovery] Erro:', err));
  }, intervalMs);
}

export function stopAutoDiscovery(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function restartAutoDiscovery(): void {
  stopAutoDiscovery();
  startAutoDiscovery();
}

export async function runDiscoveryNow(): Promise<number> {
  return runDiscovery(true);
}

export function getAutoDiscoveryStatus(): {
  running: boolean;
  lastCategories: string[];
} {
  const config = getAutoDiscoveryConfig();
  return {
    running: config.enabled && timer !== null,
    lastCategories: lastRunCategories,
  };
}
