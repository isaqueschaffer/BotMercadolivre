import { config } from '../../config';

export function generateAffiliateLink(productUrl: string): string {
  const url = new URL(productUrl);
  url.searchParams.set('matt_tool', config.ml.affiliateId);
  url.searchParams.set('matt_word', 'Default');
  return url.toString();
}
