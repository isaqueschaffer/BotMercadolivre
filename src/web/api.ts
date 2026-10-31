import express from 'express';
import path from 'path';
import { getPendingCount, getProductsByStatus, getProductById, insertProduct, updateProductStatus, updateProductDetails, moveProductToTop, moveProductToBottom } from '../db/products.repo';
import { getPostingConfig, updatePostingConfig } from '../db/posting-config.repo';
import { getAllGroups, insertGroup, removeGroup, toggleGroup } from '../db/groups.repo';
import { getPostCount, getLastPostTime } from '../db/post-history.repo';
import { MarketplaceProvider } from '../marketplace/marketplace.interface';
import { MessengerProvider } from '../messenger/messenger.interface';
import { executePost } from '../services/posting-service';
import { restartScheduler, isSchedulerRunning } from '../scheduler/scheduler';
import { fetchByQuery } from '../services/product-fetcher';
import { getTrends, getCategories, discoverByCategory } from '../marketplace/mercadolivre/ml-api';
import { getAutoDiscoveryConfig, updateAutoDiscoveryConfig } from '../db/auto-discovery.repo';
import { getAutoDiscoveryStatus, runDiscoveryNow, restartAutoDiscovery } from '../services/auto-discovery';
import { getCouponImportConfig, updateCouponImportConfig } from '../db/coupon-sync.repo';
import { importCouponsFromHtml } from '../services/coupon-sync';
import { generateHeadline, generateHeadlineOrThrow } from '../services/headline-generator';
import { getAIConfig, updateAIConfig } from '../db/ai-config.repo';
import { marketplaceManager } from '../marketplace/marketplace-manager';
import { getMarketplaceConfig, updateMarketplaceConfig } from '../db/marketplace-config.repo';
import { searchShopeeOffers } from '../marketplace/shopee/shopee-api';

export function createWebServer(
  marketplace: MarketplaceProvider,
  getMessengers: () => MessengerProvider[],
) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Status
  app.get('/api/status', (_req, res) => {
    const groups = getAllGroups();
    const postingCfg = getPostingConfig();
    const messengers = getMessengers();
    res.json({
      pending: getPendingCount(),
      posted: getPostCount(),
      lastPost: getLastPostTime(),
      activeGroups: groups.filter(g => g.enabled).length,
      schedulerActive: postingCfg.enabled && isSchedulerRunning(),
      messengers: messengers.map(m => ({
        platform: m.platform,
        connected: m.isConnected(),
      })),
      mlAuthenticated: marketplace.isAuthenticated(),
    });
  });

  // Products
  app.get('/api/products', (req, res) => {
    const status = (req.query.status as string) || 'pending';
    const limit = Number(req.query.limit) || 50;
    const products = getProductsByStatus(status as any, limit);
    res.json(products);
  });

  app.post('/api/products/add', async (req, res) => {
    const { url, headline, couponCode } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    try {
      const product = await marketplaceManager.getProductFromAny(url);
      if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

      const finalHeadline = headline || await generateHeadline(product.title, product.category);

      const id = insertProduct({
        ...product,
        headline: finalHeadline || null,
        couponCode: couponCode || null,
        source: 'manual',
        discountPercent: null,
      });
      res.json({ success: true, id, product, headline: finalHeadline });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/products/:id', (req, res) => {
    const { headline, couponCode } = req.body;
    updateProductDetails(Number(req.params.id), { headline, couponCode });
    res.json({ success: true });
  });

  app.post('/api/products/:id/generate-headline', async (req, res) => {
    try {
      const product = getProductById(Number(req.params.id));
      if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

      const headline = await generateHeadlineOrThrow(product.title, product.category);
      updateProductDetails(product.id, { headline });
      res.json({ success: true, headline });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products/skip/:id', (req, res) => {
    updateProductStatus(Number(req.params.id), 'skipped');
    res.json({ success: true });
  });

  app.post('/api/products/move-top/:id', (req, res) => {
    moveProductToTop(Number(req.params.id));
    res.json({ success: true });
  });

  app.post('/api/products/move-bottom/:id', (req, res) => {
    moveProductToBottom(Number(req.params.id));
    res.json({ success: true });
  });

  // Search
  app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Query é obrigatória' });

    try {
      const products = await marketplace.search({ query, sortBy: 'sold_quantity', limit: 20 });
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fetch', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query é obrigatória' });

    try {
      const added = await fetchByQuery(marketplace, query);
      res.json({ success: true, added });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Post now
  app.post('/api/post', async (_req, res) => {
    try {
      const success = await executePost(getMessengers(), marketplace);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Posting config (interval-based scheduler)
  app.get('/api/posting-config', (_req, res) => {
    const cfg = getPostingConfig();
    res.json({ ...cfg, running: isSchedulerRunning() });
  });

  app.put('/api/posting-config', (req, res) => {
    try {
      updatePostingConfig(req.body);
      restartScheduler(getMessengers(), marketplace);
      res.json({ success: true, config: getPostingConfig() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Groups
  app.get('/api/groups', (_req, res) => {
    res.json(getAllGroups());
  });

  app.post('/api/groups', (req, res) => {
    const { platform, groupId, groupName } = req.body;
    if (!platform || !groupId) return res.status(400).json({ error: 'platform e groupId são obrigatórios' });

    const id = insertGroup(platform, groupId, groupName || '');
    res.json({ success: true, id });
  });

  app.delete('/api/groups/:platform/:groupId', (req, res) => {
    const removed = removeGroup(req.params.platform as any, req.params.groupId);
    res.json({ success: removed });
  });

  app.patch('/api/groups/:id', (req, res) => {
    toggleGroup(Number(req.params.id), req.body.enabled);
    res.json({ success: true });
  });

  // Messenger management
  app.get('/api/messengers/status', (_req, res) => {
    const messengers = getMessengers();
    const result = messengers.map(m => ({
      platform: m.platform,
      connected: m.isConnected(),
      initialized: m.isInitialized?.() ?? m.isConnected(),
      hasQr: !!(m.getQrCode?.()),
    }));
    res.json(result);
  });

  app.get('/api/messengers/qr/:platform', (_req, res) => {
    const messenger = getMessengers().find(m => m.platform === _req.params.platform);
    if (!messenger) return res.json({ qr: null, connected: false, initialized: false });
    const qr = messenger.getQrCode?.() || null;
    res.json({
      qr,
      connected: messenger.isConnected(),
      initialized: messenger.isInitialized?.() ?? messenger.isConnected(),
    });
  });

  app.post('/api/messengers/connect/:platform', async (req, res) => {
    const messenger = getMessengers().find(m => m.platform === req.params.platform);
    if (!messenger) return res.status(404).json({ error: 'Plataforma não encontrada' });

    try {
      await messenger.initialize();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/messengers/disconnect/:platform', async (req, res) => {
    const messenger = getMessengers().find(m => m.platform === req.params.platform);
    if (!messenger) return res.status(404).json({ error: 'Plataforma não encontrada' });

    try {
      await messenger.disconnect(true);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/messengers/groups/:platform', async (req, res) => {
    const messenger = getMessengers().find(m => m.platform === req.params.platform);
    if (!messenger || !messenger.getAvailableGroups) {
      return res.json([]);
    }
    try {
      const groups = await messenger.getAvailableGroups();
      res.json(groups);
    } catch {
      res.json([]);
    }
  });

  // Discovery
  app.get('/api/trends', async (_req, res) => {
    try {
      const trends = await getTrends();
      res.json(trends);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/categories', async (_req, res) => {
    try {
      const cats = await getCategories();
      res.json(cats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/discover/:categoryId', async (req, res) => {
    try {
      const products = await discoverByCategory(req.params.categoryId, 20);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auto-Discovery
  app.get('/api/auto-discovery', (_req, res) => {
    const config = getAutoDiscoveryConfig();
    const status = getAutoDiscoveryStatus();
    res.json({ ...config, ...status });
  });

  app.put('/api/auto-discovery', (req, res) => {
    try {
      updateAutoDiscoveryConfig(req.body);
      restartAutoDiscovery();
      res.json({ success: true, config: getAutoDiscoveryConfig() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auto-discovery/run', async (_req, res) => {
    try {
      const added = await runDiscoveryNow();
      res.json({ success: true, added });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Coupon Sync (cupons do Mercado Livre — importação do HTML colado manualmente)
  app.get('/api/coupon-sync', (_req, res) => {
    res.json(getCouponImportConfig());
  });

  app.put('/api/coupon-sync', (req, res) => {
    try {
      updateCouponImportConfig(req.body);
      res.json({ success: true, config: getCouponImportConfig() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/coupon-sync/import', async (req, res) => {
    try {
      const { html } = req.body;
      if (!html) return res.status(400).json({ error: 'HTML é obrigatório' });
      const added = await importCouponsFromHtml(html);
      res.json({ success: true, added });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Config
  app.get('/api/ai-config', (_req, res) => {
    const config = getAIConfig();
    // Never expose keys in full — mask them
    const mask = (k: string | null) => k ? k.slice(0, 8) + '••••••••' : null;
    res.json({
      provider: config.provider,
      anthropicModel: config.anthropicModel,
      openaiModel: config.openaiModel,
      geminiModel: config.geminiModel,
      anthropicKeySet: !!config.anthropicApiKey,
      openaiKeySet: !!config.openaiApiKey,
      geminiKeySet: !!config.geminiApiKey,
      anthropicKeyMasked: mask(config.anthropicApiKey),
      openaiKeyMasked: mask(config.openaiApiKey),
      geminiKeyMasked: mask(config.geminiApiKey),
    });
  });

  app.put('/api/ai-config', (req, res) => {
    try {
      const { provider, anthropicModel, openaiModel, geminiModel,
              anthropicApiKey, openaiApiKey, geminiApiKey } = req.body;
      updateAIConfig({ provider, anthropicModel, openaiModel, geminiModel,
                       anthropicApiKey, openaiApiKey, geminiApiKey });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ai-config/test', async (_req, res) => {
    try {
      const headline = await generateHeadlineOrThrow('Fone de Ouvido Bluetooth JBL Wave Buds', 'Eletrônicos');
      res.json({ success: true, headline });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Marketplaces Config
  app.get('/api/marketplaces/config', (_req, res) => {
    const cfg = getMarketplaceConfig();
    const mask = (k: string | null) => k ? k.slice(0, 6) + '••••••••' : null;
    res.json({
      shopeeAppId: cfg.shopeeAppId,
      shopeeConfigured: Boolean(cfg.shopeeAppId && cfg.shopeeSecret),
      shopeeSecretMasked: mask(cfg.shopeeSecret),
      amazonPartnerTag: cfg.amazonPartnerTag,
      amazonConfigured: Boolean(cfg.amazonPartnerTag),
      amazonAccessKey: cfg.amazonAccessKey,
      amazonSecretMasked: mask(cfg.amazonSecretKey),
    });
  });

  app.put('/api/marketplaces/config', (req, res) => {
    try {
      const { shopeeAppId, shopeeSecret, amazonPartnerTag, amazonAccessKey, amazonSecretKey } = req.body;
      updateMarketplaceConfig({
        shopeeAppId,
        shopeeSecret: shopeeSecret || undefined,
        amazonPartnerTag,
        amazonAccessKey,
        amazonSecretKey: amazonSecretKey || undefined,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/marketplaces/shopee/test', async (_req, res) => {
    try {
      const prods = await searchShopeeOffers('fone', 1);
      if (prods.length > 0) {
        res.json({ success: true, message: `Conexão bem-sucedida! Produto teste: "${prods[0].title}"` });
      } else {
        res.json({ success: true, message: 'Conexão estabelecida com a Shopee Open API!' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
