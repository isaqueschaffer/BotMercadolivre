import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { config } from './config';
import { initDatabase } from './db/database';
import { MercadoLivreMarketplace } from './marketplace/mercadolivre/ml-marketplace';
import { TelegramBot } from './messenger/telegram/telegram-bot';
import { WhatsAppBot } from './messenger/whatsapp/whatsapp-bot';
import { MessengerProvider } from './messenger/messenger.interface';
import { startScheduler, stopAllJobs } from './scheduler/scheduler';
import { createWebServer } from './web/api';
import { startAutoDiscovery, stopAutoDiscovery } from './services/auto-discovery';

const WEB_PORT = Number(process.env.WEB_PORT || 4000);

async function main(): Promise<void> {
  console.log('🚀 Iniciando Bot de Afiliados...\n');

  // 1. Database
  await initDatabase();
  console.log('✅ Banco de dados inicializado.\n');

  // 2. Marketplace
  const marketplace = new MercadoLivreMarketplace();
  await marketplace.initialize();
  console.log('');

  // 3. Messengers
  const messengers: MessengerProvider[] = [];

  const telegramBot = new TelegramBot(marketplace);
  await telegramBot.initialize();
  messengers.push(telegramBot);

  // WhatsApp is always created but only auto-connects if enabled in .env
  // or if the user has previously connected (auth state exists)
  const whatsappBot = new WhatsAppBot();
  messengers.push(whatsappBot);

  if (config.whatsapp.enabled) {
    await whatsappBot.initialize();
  } else {
    // Try to auto-connect if auth state exists from a previous dashboard connection
    const hasAuthState = whatsappBot.hasExistingAuth();
    if (hasAuthState) {
      console.log('[WhatsApp] Auth anterior encontrada. Reconectando...');
      await whatsappBot.initialize();
    } else {
      console.log('[WhatsApp] Desabilitado. Ative pelo dashboard ou defina WHATSAPP_ENABLED=true.\n');
    }
  }

  telegramBot.setMessengers(messengers);

  // 4. Scheduler (postagem automática por intervalo)
  startScheduler(messengers, marketplace);

  // 5. Auto-Discovery
  startAutoDiscovery();

  // 6. Web Dashboard
  const app = createWebServer(marketplace, () => messengers);
  app.listen(WEB_PORT, () => {
    console.log(`🌐 Dashboard: http://localhost:${WEB_PORT}\n`);
  });

  console.log('🟢 Bot rodando! Pressione Ctrl+C para parar.\n');

  const shutdown = async () => {
    console.log('\n🔴 Encerrando...');
    stopAllJobs();
    stopAutoDiscovery();
    for (const m of messengers) {
      await m.disconnect();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
