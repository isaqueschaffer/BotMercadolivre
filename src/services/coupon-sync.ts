import { parseCouponsFromHtml, ScrapedCoupon } from '../marketplace/mercadolivre/ml-coupons-parser';
import { upsertCouponToPool, getAvailableCoupons, markCouponConsumed, getPoolStats } from '../db/coupon-pool.repo';
import { getProductsByStatus, updateProductDetails } from '../db/products.repo';
import { getTopLevelCategoryName } from '../marketplace/mercadolivre/ml-api';
import { getCouponImportConfig, recordCouponImportRun } from '../db/coupon-sync.repo';

let importing = false;

function normalizeCategory(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Só cupons com código "digitável" fazem sentido anexados a um produto qualquer —
 * cupons só-com-link apontam para uma coleção própria, não para o produto postado. */
function isUsable(c: ScrapedCoupon): boolean {
  return Boolean(c.campaignId) && Boolean(c.code) && Boolean(c.categoryTitle);
}

/**
 * Tenta casar um cupom disponível no pool com um produto recém-criado,
 * pela categoria raiz do Mercado Livre. Deve ser chamada depois de inserir
 * qualquer novo produto na fila (manual, auto-discovery, etc.).
 */
export async function tryAttachPoolCoupon(productId: number, marketplace: string, categoryId: string | null): Promise<boolean> {
  if (marketplace !== 'mercadolivre' || !categoryId) return false;

  const available = getAvailableCoupons();
  if (available.length === 0) return false;

  const topName = await getTopLevelCategoryName(categoryId);
  if (!topName) return false;

  const normalizedTop = normalizeCategory(topName);
  const match = available.find(c => c.categoryTitle && normalizeCategory(c.categoryTitle) === normalizedTop);
  if (!match) return false;

  updateProductDetails(productId, { couponCode: match.code });
  markCouponConsumed(match.id, productId);
  console.log(`[CouponSync] Cupom ${match.code} anexado ao produto #${productId} (categoria: ${topName}).`);
  return true;
}

async function attachToExistingPending(coupon: ScrapedCoupon, candidates: { id: number; category: string | null }[], categoryNameCache: Map<string, string | null>): Promise<number | null> {
  const normalizedCoupon = normalizeCategory(coupon.categoryTitle);

  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    if (!p.category) continue;

    let name = categoryNameCache.get(p.category);
    if (name === undefined) {
      name = await getTopLevelCategoryName(p.category);
      categoryNameCache.set(p.category, name);
    }
    if (name && normalizeCategory(name) === normalizedCoupon) {
      candidates.splice(i, 1);
      return p.id;
    }
  }

  return null;
}

export async function importCouponsFromHtml(html: string): Promise<{ attached: number; pooled: number }> {
  if (importing) throw new Error('Já existe uma importação de cupons em andamento.');
  importing = true;

  try {
    const config = getCouponImportConfig();
    const coupons = parseCouponsFromHtml(html).filter(isUsable);

    const pendingProducts = getProductsByStatus('pending', 500)
      .filter(p => p.marketplace === 'mercadolivre' && !p.couponCode)
      .map(p => ({ id: p.id, category: p.category }));

    const categoryNameCache = new Map<string, string | null>();
    let attached = 0;
    let pooled = 0;

    for (const c of coupons) {
      if (attached + pooled >= config.maxPerRun) break;

      // Garante que o cupom existe no pool (idempotente por campaignId) mesmo se já tiver sido importado antes.
      const poolId = upsertCouponToPool({
        campaignId: c.campaignId,
        categoryTitle: c.categoryTitle,
        code: c.code,
        actionLink: c.actionLink,
        title: c.title,
        minAmountText: c.minAmountText,
        capAmountText: c.capAmountText,
        expirationText: c.expirationText,
      });

      const productId = await attachToExistingPending(c, pendingProducts, categoryNameCache);

      if (productId) {
        updateProductDetails(productId, { couponCode: c.code });
        markCouponConsumed(poolId, productId);
        attached++;
      } else {
        pooled++;
      }
    }

    console.log(`[CouponSync] ${attached} cupons anexados a produtos existentes, ${pooled} aguardando produto compatível.`);
    recordCouponImportRun('ok', attached, pooled, null);
    return { attached, pooled };
  } catch (err) {
    console.error('[CouponSync] Erro ao importar cupons:', err);
    recordCouponImportRun('error', 0, 0, (err as Error).message);
    throw err;
  } finally {
    importing = false;
  }
}

export function getCouponPoolStats(): { available: number; consumed: number } {
  return getPoolStats();
}
