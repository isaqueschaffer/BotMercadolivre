import { getDb, saveDatabase } from './database';

export interface MarketplaceConfig {
  shopeeAppId: string | null;
  shopeeSecret: string | null;
  amazonPartnerTag: string | null;
  amazonAccessKey: string | null;
  amazonSecretKey: string | null;
}

const DEFAULTS: MarketplaceConfig = {
  shopeeAppId: process.env.SHOPEE_APP_ID || null,
  shopeeSecret: process.env.SHOPEE_SECRET || null,
  amazonPartnerTag: process.env.AMAZON_PARTNER_TAG || null,
  amazonAccessKey: process.env.AMAZON_ACCESS_KEY || null,
  amazonSecretKey: process.env.AMAZON_SECRET_KEY || null,
};

const COLUMN_MAP: Record<keyof MarketplaceConfig, string> = {
  shopeeAppId: 'shopee_app_id',
  shopeeSecret: 'shopee_secret',
  amazonPartnerTag: 'amazon_partner_tag',
  amazonAccessKey: 'amazon_access_key',
  amazonSecretKey: 'amazon_secret_key',
};

export function getMarketplaceConfig(): MarketplaceConfig {
  const db = getDb();
  const result = db.exec('SELECT * FROM marketplace_config WHERE id = 1');
  if (!result[0] || result[0].values.length === 0) return DEFAULTS;

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });

  return {
    shopeeAppId: (row['shopee_app_id'] as string) || process.env.SHOPEE_APP_ID || null,
    shopeeSecret: (row['shopee_secret'] as string) || process.env.SHOPEE_SECRET || null,
    amazonPartnerTag: (row['amazon_partner_tag'] as string) || process.env.AMAZON_PARTNER_TAG || null,
    amazonAccessKey: (row['amazon_access_key'] as string) || process.env.AMAZON_ACCESS_KEY || null,
    amazonSecretKey: (row['amazon_secret_key'] as string) || process.env.AMAZON_SECRET_KEY || null,
  };
}

export function updateMarketplaceConfig(fields: Partial<MarketplaceConfig>): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, val] of Object.entries(fields)) {
    const col = COLUMN_MAP[key as keyof MarketplaceConfig];
    if (col && val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(val);
    }
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  db.run(`UPDATE marketplace_config SET ${sets.join(', ')} WHERE id = 1`, params as any[]);
  saveDatabase();
}
