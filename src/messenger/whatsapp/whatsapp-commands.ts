import { getPendingCount, getProductsByStatus } from '../../db/products.repo';
import { getPostCount, getLastPostTime } from '../../db/post-history.repo';
import { getAllGroups } from '../../db/groups.repo';
import { getPostingConfig } from '../../db/posting-config.repo';

export function handleWhatsAppCommand(text: string): string | null {
  const [command] = text.trim().split(/\s+/);

  switch (command.toLowerCase()) {
    case '!help':
      return (
        '🤖 *Bot de Afiliados*\n\n' +
        '!status — Status do bot\n' +
        '!list — Produtos pendentes\n' +
        '!groups — Listar grupos\n' +
        '!help — Este menu'
      );

    case '!status': {
      const pending = getPendingCount();
      const posted = getPostCount();
      const lastPost = getLastPostTime();
      const groups = getAllGroups();
      const postingCfg = getPostingConfig();

      return (
        '📊 *Status do Bot*\n\n' +
        `📦 Produtos pendentes: ${pending}\n` +
        `✅ Total postados: ${posted}\n` +
        `🕐 Último post: ${lastPost || 'Nenhum'}\n` +
        `📋 Grupos ativos: ${groups.filter(g => g.enabled).length}\n` +
        `📅 Postagem: ${postingCfg.enabled ? `a cada ${postingCfg.intervalMinutes}min` : 'desativada'}`
      );
    }

    case '!list': {
      const products = getProductsByStatus('pending', 10);
      if (products.length === 0) return '📭 Nenhum produto pendente.';

      const lines = products.map((p, i) => {
        const discount = p.discountPercent ? ` (-${p.discountPercent}%)` : '';
        const source = p.source === 'manual' ? '✋' : '🤖';
        return `${i + 1}. ${source} ${p.title.slice(0, 50)}...\n   R$ ${p.price.toFixed(2)}${discount}`;
      });

      return `📦 *Pendentes:*\n\n${lines.join('\n\n')}`;
    }

    case '!groups': {
      const groups = getAllGroups();
      if (groups.length === 0) return '📭 Nenhum grupo registrado.';

      const lines = groups.map(g =>
        `${g.platform === 'telegram' ? '📱' : '💬'} ${g.groupName} (${g.platform}) ${g.enabled ? '✅' : '❌'}`
      );
      return `📋 *Grupos:*\n\n${lines.join('\n')}`;
    }

    default:
      return null;
  }
}
