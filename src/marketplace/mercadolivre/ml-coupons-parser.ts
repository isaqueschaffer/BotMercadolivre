/**
 * Extrai os cupons embutidos no HTML da página "Cupons" do Mercado Livre
 * (mercadolivre.com.br/cupons?source_page=mperfil). A página é renderizada
 * no servidor (framework Nordic) e embute os dados em
 * window._n.ctx.r.appProps.pageProps.landingData — sem chamada de API separada.
 *
 * O Mercado Livre bloqueia requisições automatizadas (curl, navegador headless
 * via CDP) com um captcha, então esse HTML precisa ser colado manualmente
 * (Ctrl+U na página logada, Ctrl+A, Ctrl+C) em vez de buscado pelo bot.
 */

function extractBalancedJson(text: string, openBraceIndex: number): string | null {
  if (text[openBraceIndex] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(openBraceIndex, i + 1);
      }
    }
  }

  return null;
}

function extractLandingData(html: string): any | null {
  const marker = '_n.ctx.r=';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const jsonStart = markerIndex + marker.length;
  const jsonText = extractBalancedJson(html, jsonStart);
  if (!jsonText) return null;

  try {
    const ctx = JSON.parse(jsonText);
    return ctx?.appProps?.pageProps?.landingData || null;
  } catch {
    return null;
  }
}

export interface ScrapedCoupon {
  campaignId: string;
  title: string;
  categoryTitle: string;
  code: string | null;
  minAmountText: string | null;
  capAmountText: string | null;
  expirationText: string | null;
  status: string;
  actionLink: string | null;
  sampleImageUrl: string | null;
  sampleItemAlt: string | null;
}

export class NoLandingDataError extends Error {
  constructor() {
    super('Não encontrei os dados de cupons nesse HTML. Confirme que colou o código-fonte (Ctrl+U) da página mercadolivre.com.br/cupons.');
  }
}

export function parseCouponsFromHtml(html: string): ScrapedCoupon[] {
  const landingData = extractLandingData(html);
  if (!landingData) throw new NoLandingDataError();

  const groupings = landingData.groupings || [];
  const coupons: ScrapedCoupon[] = [];

  for (const group of groupings) {
    const categoryTitle = group.title || '';
    for (const c of group.coupons || []) {
      const item = (c.items || [])[0];
      coupons.push({
        campaignId: String(c.campaignId || ''),
        title: c.title?.text || '',
        categoryTitle,
        code: c.code || null,
        minAmountText: c.amount?.minAmount || null,
        capAmountText: c.amount?.capAmount || null,
        expirationText: c.expirationDate?.text || null,
        status: c.status?.id || 'UNKNOWN',
        actionLink: c.action?.type === 'link' ? (c.action.value || null) : null,
        sampleImageUrl: item?.imageUrl || null,
        sampleItemAlt: item?.altText || null,
      });
    }
  }

  return coupons;
}
