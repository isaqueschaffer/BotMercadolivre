import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  anthropic: {
    apiKey: optional('ANTHROPIC_API_KEY', ''),
  },
  ml: {
    appId: required('ML_APP_ID'),
    secret: required('ML_SECRET'),
    redirectUri: optional('ML_REDIRECT_URI', 'https://gerador-de-aula-de-pilates.isaquegeovaneschaffer.workers.dev/aulas/abc03d71-9ddd-5966-a535-dcd8244a216c'),
    affiliateId: required('ML_AFFILIATE_ID'),
  },
  shopee: {
    appId: optional('SHOPEE_APP_ID', ''),
    secret: optional('SHOPEE_SECRET', ''),
  },
  amazon: {
    partnerTag: optional('AMAZON_PARTNER_TAG', ''),
    accessKey: optional('AMAZON_ACCESS_KEY', ''),
    secretKey: optional('AMAZON_SECRET_KEY', ''),
  },
  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
    adminIds: required('TELEGRAM_ADMIN_IDS').split(',').map(Number),
  },
  whatsapp: {
    enabled: optional('WHATSAPP_ENABLED', 'false') === 'true',
    adminNumbers: optional('WHATSAPP_ADMIN_NUMBERS', '').split(',').filter(Boolean),
  },
  scheduler: {
    timezone: optional('DEFAULT_TIMEZONE', 'America/Sao_Paulo'),
    autoFetchEnabled: optional('AUTO_FETCH_ENABLED', 'true') === 'true',
    autoFetchIntervalHours: Number(optional('AUTO_FETCH_INTERVAL_HOURS', '6')),
    minDiscountPercent: Number(optional('MIN_DISCOUNT_PERCENT', '10')),
  },
  affiliateLinkStrategy: optional('AFFILIATE_LINK_STRATEGY', 'url_params') as 'url_params' | 'create_link',
  dbPath: path.resolve(optional('DB_PATH', './data/bot.db')),
};
