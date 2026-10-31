import { pickNextProduct, ensureAffiliateLink, markPosted, markFailed } from '../scheduler/product-queue';
import { formatProductMessage } from '../messenger/message-formatter';
import { MessengerProvider } from '../messenger/messenger.interface';
import { MarketplaceProvider } from '../marketplace/marketplace.interface';
import { getEnabledGroups } from '../db/groups.repo';
import { recordPost } from '../db/post-history.repo';
import { getPendingCount } from '../db/products.repo';
import { runDiscoveryNow } from './auto-discovery';

export async function executePost(
  messengers: MessengerProvider[],
  marketplace: MarketplaceProvider
): Promise<boolean> {
  let product = pickNextProduct();

  if (!product) {
    console.log('[Posting] Fila vazia. Executando busca automática...');
    await runDiscoveryNow();
    product = pickNextProduct();
  }

  if (!product) {
    console.log('[Posting] Nenhum produto disponível para postar.');
    return false;
  }

  product = await ensureAffiliateLink(product, marketplace);
  console.log(`[Posting] Postando: ${product.title}`);

  let anySuccess = false;

  for (const messenger of messengers) {
    if (!messenger.isConnected()) continue;

    const groups = getEnabledGroups(messenger.platform);
    const message = formatProductMessage(product, messenger.platform);

    for (const group of groups) {
      const result = await messenger.sendProductPost(group.groupId, message);

      recordPost(
        product.id,
        messenger.platform,
        group.groupId,
        result.success,
        result.messageId,
        result.error
      );

      if (result.success) {
        anySuccess = true;
        console.log(`[Posting] ✅ Enviado para ${group.groupName} (${messenger.platform})`);
      } else {
        console.error(`[Posting] ❌ Falha em ${group.groupName}: ${result.error}`);
      }

      // Rate limit: espera entre envios para grupos diferentes
      await delay(2000 + Math.random() * 3000);
    }
  }

  if (anySuccess) {
    markPosted(product.id);
  } else {
    markFailed(product.id);
  }

  const remaining = getPendingCount();
  console.log(`[Posting] Produtos restantes na fila: ${remaining}`);

  return anySuccess;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
