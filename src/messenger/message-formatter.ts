import { Product } from '../types/product';
import { PostableMessage } from '../types/message';
import { Platform } from '../types/group';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function shortTitle(product: Product): string {
  return product.title
    .replace(/\s+(Cor|Color)\s+\w+$/i, '')
    .replace(/\s+-\s+\w+$/i, '')
    .split(' ').slice(0, 8).join(' ');
}

function formatTelegram(product: Product): string {
  const lines: string[] = [];

  const headline = product.headline || shortTitle(product);
  lines.push(`<b>${escapeHtml(headline.toUpperCase())}</b>`);
  lines.push('');

  lines.push(escapeHtml(product.title));
  lines.push('');

  if (product.originalPrice && product.originalPrice > product.price) {
    lines.push(`De: ${formatPrice(product.originalPrice)} | Por: <b>R$${formatPrice(product.price)}</b> 👑`);
  } else {
    lines.push(`Por: <b>R$${formatPrice(product.price)}</b> 👑`);
  }

  if (product.couponCode) {
    lines.push(`⚠️ cupom: <b>${escapeHtml(product.couponCode)}</b>`);
  }

  lines.push('');

  const link = product.affiliateUrl || product.productUrl;
  lines.push(`Link: ${link}`);

  if (product.freeShipping) {
    lines.push('');
    lines.push('🚛 frete grátis fazendo login');
  }

  return lines.join('\n');
}

function formatWhatsApp(product: Product): string {
  const lines: string[] = [];

  const headline = product.headline || shortTitle(product);
  lines.push(`*${headline.toUpperCase()}*`);
  lines.push('');

  lines.push(product.title);
  lines.push('');

  if (product.originalPrice && product.originalPrice > product.price) {
    lines.push(`De: ${formatPrice(product.originalPrice)} | Por: *R$${formatPrice(product.price)}* 👑`);
  } else {
    lines.push(`Por: *R$${formatPrice(product.price)}* 👑`);
  }

  if (product.couponCode) {
    lines.push(`⚠️ cupom: *${product.couponCode}*`);
  }

  lines.push('');

  const link = product.affiliateUrl || product.productUrl;
  lines.push(`Link: ${link}`);

  if (product.freeShipping) {
    lines.push('');
    lines.push('🚛 frete grátis fazendo login');
  }

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatProductMessage(product: Product, platform: Platform): PostableMessage {
  const caption = platform === 'telegram'
    ? formatTelegram(product)
    : formatWhatsApp(product);

  return {
    imageUrl: product.imageUrl,
    caption,
    platform,
  };
}
