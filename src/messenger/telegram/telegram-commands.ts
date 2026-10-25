import { Bot, Context } from 'grammy';
import { config } from '../../config';
import { insertGroup, removeGroup, getAllGroups } from '../../db/groups.repo';
import { getPostingConfig, updatePostingConfig } from '../../db/posting-config.repo';
import { getPendingCount, getProductsByStatus, insertProduct } from '../../db/products.repo';
import { getPostCount, getLastPostTime } from '../../db/post-history.repo';
import { isSchedulerRunning } from '../../scheduler/scheduler';
import { MarketplaceProvider } from '../../marketplace/marketplace.interface';
import { MessengerProvider } from '../messenger.interface';
import { executePost } from '../../services/posting-service';
import { fetchByQuery } from '../../services/product-fetcher';
import { generateHeadline } from '../../services/headline-generator';
import { marketplaceManager } from '../../marketplace/marketplace-manager';

export type SetMessengersFn = (messengers: MessengerProvider[]) => void;

function isAdmin(ctx: Context): boolean {
  return config.telegram.adminIds.includes(ctx.from?.id || 0);
}

export function registerCommands(bot: Bot): void {
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '🤖 <b>Bot de Afiliados</b>\n\n' +
      'Comandos disponíveis:\n' +
      '/add &lt;url&gt; — Adicionar produto\n' +
      '/post — Postar próximo produto agora\n' +
      '/status — Status do bot\n' +
      '/list — Produtos pendentes\n' +
      '/search &lt;query&gt; — Buscar no ML\n' +
      '/fetch &lt;query&gt; — Buscar e adicionar à fila\n' +
      '/addgroup — Registrar este grupo\n' +
      '/removegroup — Remover este grupo\n' +
      '/groups — Listar grupos\n' +
      '/stop — Pausar postagem automática',
      { parse_mode: 'HTML' }
    );
  });

  bot.command('addgroup', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const chatId = String(ctx.chat.id);
    const chatTitle = ctx.chat.type === 'private'
      ? `DM: ${ctx.from?.first_name}`
      : (ctx.chat as { title?: string }).title || 'Grupo';

    insertGroup('telegram', chatId, chatTitle);
    await ctx.reply(`✅ Grupo registrado: <b>${chatTitle}</b>`, { parse_mode: 'HTML' });
  });

  bot.command('removegroup', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const chatId = String(ctx.chat.id);
    const removed = removeGroup('telegram', chatId);
    await ctx.reply(removed ? '✅ Grupo removido.' : '⚠️ Grupo não encontrado.');
  });

  bot.command('groups', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const groups = getAllGroups();
    if (groups.length === 0) return ctx.reply('📭 Nenhum grupo registrado.');

    const lines = groups.map(g =>
      `${g.platform === 'telegram' ? '📱' : '💬'} ${g.groupName} (${g.platform}) ${g.enabled ? '✅' : '❌'}`
    );
    await ctx.reply(`📋 <b>Grupos:</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  });

  bot.command('postconfig', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const postingCfg = getPostingConfig();
    const running = isSchedulerRunning();

    await ctx.reply(
      `📅 <b>Postagem Automática</b>\n\n` +
      `Status: ${postingCfg.enabled ? '✅ Ativada' : '❌ Desativada'}\n` +
      `Intervalo: ${postingCfg.intervalMinutes} min\n` +
      `Rodando: ${running ? '✅' : '❌'}\n\n` +
      `Gerencie pelo dashboard: http://localhost:4000`,
      { parse_mode: 'HTML' }
    );
  });

  bot.command('status', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const pending = getPendingCount();
    const posted = getPostCount();
    const lastPost = getLastPostTime();
    const groups = getAllGroups();
    const postingCfg = getPostingConfig();

    await ctx.reply(
      '📊 <b>Status do Bot</b>\n\n' +
      `📦 Produtos pendentes: ${pending}\n` +
      `✅ Total postados: ${posted}\n` +
      `🕐 Último post: ${lastPost || 'Nenhum'}\n` +
      `📋 Grupos ativos: ${groups.filter(g => g.enabled).length}\n` +
      `📅 Postagem: ${postingCfg.enabled ? `a cada ${postingCfg.intervalMinutes}min` : 'desativada'}`,
      { parse_mode: 'HTML' }
    );
  });

  bot.command('list', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const products = getProductsByStatus('pending', 10);
    if (products.length === 0) return ctx.reply('📭 Nenhum produto pendente.');

    const lines = products.map((p, i) => {
      const discount = p.discountPercent ? ` (-${p.discountPercent}%)` : '';
      const source = p.source === 'manual' ? '✋' : '🤖';
      return `${i + 1}. ${source} ${p.title.slice(0, 50)}...\n   R$ ${p.price.toFixed(2)}${discount}`;
    });

    await ctx.reply(`📦 <b>Pendentes:</b>\n\n${lines.join('\n\n')}`, { parse_mode: 'HTML' });
  });

  bot.command('stop', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');
    updatePostingConfig({ enabled: false });
    await ctx.reply('⏸ Postagem automática desativada.\nReative pelo dashboard ou /postconfig.');
  });
}

export function registerAdvancedCommands(
  bot: Bot,
  marketplace: MarketplaceProvider,
): SetMessengersFn {
  let messengersRef: MessengerProvider[] = [];

  bot.command('add', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const url = ctx.match?.trim();
    if (!url) return ctx.reply('📎 <b>Uso:</b> /add &lt;url do produto&gt;', { parse_mode: 'HTML' });

    await ctx.reply('⏳ Buscando produto...');

    try {
      const product = await marketplaceManager.getProductFromAny(url);
      if (!product) {
        return ctx.reply('❌ Produto não encontrado. Verifique a URL.');
      }

      const headline = await generateHeadline(product.title, product.category);

      insertProduct({
        ...product,
        headline,
        couponCode: null,
        source: 'manual',
        discountPercent: null,
      });

      const discount = product.originalPrice && product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) + '% OFF'
        : '';

      await ctx.reply(
        `✅ Produto adicionado à fila!\n\n` +
        `📦 <b>${product.title}</b>\n` +
        `💰 R$ ${product.price.toFixed(2)} ${discount}\n` +
        `🏪 ${product.marketplace}`,
        { parse_mode: 'HTML' }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao buscar produto: ${msg}`);
    }
  });

  bot.command('search', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const query = ctx.match?.trim();
    if (!query) return ctx.reply('🔍 <b>Uso:</b> /search &lt;termo&gt;', { parse_mode: 'HTML' });

    await ctx.reply(`🔍 Buscando "${query}"...`);

    try {
      const products = await marketplace.search({ query, sortBy: 'sold_quantity', limit: 5 });

      if (products.length === 0) {
        return ctx.reply('📭 Nenhum produto encontrado.');
      }

      const lines = products.map((p, i) => {
        const discount = p.originalPrice && p.originalPrice > p.price
          ? ` (-${Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%)`
          : '';
        const ship = p.freeShipping ? ' 🚚' : '';
        return `${i + 1}. <b>${p.title.slice(0, 60)}</b>\n   R$ ${p.price.toFixed(2)}${discount}${ship}`;
      });

      await ctx.reply(
        `🔍 <b>Resultados para "${query}":</b>\n\n${lines.join('\n\n')}\n\n` +
        'Use /add &lt;url&gt; para adicionar um produto à fila.',
        { parse_mode: 'HTML' }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro na busca: ${msg}`);
    }
  });

  bot.command('post', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    await ctx.reply('⏳ Postando próximo produto...');

    try {
      const success = await executePost(messengersRef, marketplace);
      if (success) {
        await ctx.reply('✅ Produto postado com sucesso!');
      } else {
        await ctx.reply('⚠️ Nenhum produto disponível para postar.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao postar: ${msg}`);
    }
  });

  bot.command('fetch', async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply('⛔ Apenas administradores.');

    const query = ctx.match?.trim();
    if (!query) {
      return ctx.reply('🔍 <b>Uso:</b> /fetch &lt;termo&gt;\nBusca e adiciona produtos à fila automaticamente.', { parse_mode: 'HTML' });
    }

    await ctx.reply(`🔍 Buscando e adicionando produtos de "${query}"...`);

    try {
      const added = await fetchByQuery(marketplace, query);
      await ctx.reply(`✅ ${added} produto(s) adicionado(s) à fila.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro: ${msg}`);
    }
  });

  return (messengers: MessengerProvider[]) => {
    messengersRef = messengers;
  };
}
