import axios from 'axios';
import { config } from '../../config';

/** Encurta uma URL via TinyURL (serviço público, sem autenticação). Se falhar, retorna a URL original. */
export async function shortenUrl(url: string): Promise<string> {
  try {
    const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get<string>(apiUrl, { timeout: 5000, responseType: 'text' });
    const short = typeof data === 'string' ? data.trim() : '';
    return short.startsWith('http') ? short : url;
  } catch {
    return url;
  }
}

export async function generateAffiliateLink(productUrl: string): Promise<string> {
  const url = new URL(productUrl);
  url.searchParams.set('matt_tool', config.ml.affiliateId);
  url.searchParams.set('matt_word', 'Default');
  return shortenUrl(url.toString());
}
