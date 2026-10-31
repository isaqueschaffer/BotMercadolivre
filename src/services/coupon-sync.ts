import { parseCouponsFromHtml, ScrapedCoupon } from '../marketplace/mercadolivre/ml-coupons-parser';
import { insertProduct, productExists } from '../db/products.repo';
import { getCouponImportConfig, recordCouponImportRun } from '../db/coupon-sync.repo';

const FALLBACK_URL = 'https://www.mercadolivre.com.br/cupons?source_page=mperfil';

let importing = false;

function isUsable(c: ScrapedCoupon): boolean {
  return Boolean(c.campaignId) && Boolean(c.code || c.actionLink);
}

function buildHeadline(c: ScrapedCoupon): string {
  const parts = [c.title];
  if (c.minAmountText) parts.push(c.minAmountText);
  if (c.capAmountText) parts.push(c.capAmountText);
  return parts.filter(Boolean).join(' • ');
}

export async function importCouponsFromHtml(html: string): Promise<number> {
  if (importing) throw new Error('Já existe uma importação de cupons em andamento.');
  importing = true;

  try {
    const config = getCouponImportConfig();
    const coupons = parseCouponsFromHtml(html);
    const usable = coupons.filter(isUsable);

    let added = 0;
    for (const c of usable) {
      if (added >= config.maxPerRun) break;

      const externalId = `CUPOM-${c.campaignId}`;
      if (productExists(externalId, 'mercadolivre')) continue;

      insertProduct({
        externalId,
        marketplace: 'mercadolivre',
        title: c.sampleItemAlt || c.title,
        headline: buildHeadline(c),
        price: 0,
        originalPrice: null,
        currency: 'BRL',
        imageUrl: c.sampleImageUrl || 'https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/favicon.svg',
        productUrl: c.actionLink || FALLBACK_URL,
        affiliateUrl: null,
        category: c.categoryTitle || null,
        condition: null,
        soldQuantity: null,
        freeShipping: false,
        couponCode: c.code,
        source: 'auto',
        discountPercent: null,
      });
      added++;
    }

    console.log(`[CouponSync] ${added} cupons novos adicionados à fila (de ${coupons.length} encontrados no HTML).`);
    recordCouponImportRun('ok', added, null);
    return added;
  } catch (err) {
    console.error('[CouponSync] Erro ao importar cupons:', err);
    recordCouponImportRun('error', 0, (err as Error).message);
    throw err;
  } finally {
    importing = false;
  }
}
