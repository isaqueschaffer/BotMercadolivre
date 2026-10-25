import { getDb, saveDatabase } from './database';

export interface AutoDiscoveryConfig {
  enabled: boolean;
  intervalMinutes: number;
  minDiscount: number;
  freeShippingOnly: boolean;
  maxPrice: number | null;
  maxProductsPerRun: number;
  categories: string[];
}

export function getAutoDiscoveryConfig(): AutoDiscoveryConfig {
  const db = getDb();
  const result = db.exec('SELECT * FROM auto_discovery_config WHERE id = 1');
  if (!result[0] || result[0].values.length === 0) {
    return {
      enabled: false,
      intervalMinutes: 60,
      minDiscount: 10,
      freeShippingOnly: false,
      maxPrice: null,
      maxProductsPerRun: 10,
      categories: [],
    };
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });

  let categories: string[] = [];
  try {
    categories = JSON.parse(row.categories as string);
  } catch {}

  return {
    enabled: Boolean(row.enabled),
    intervalMinutes: row.interval_minutes as number,
    minDiscount: row.min_discount as number,
    freeShippingOnly: Boolean(row.free_shipping_only),
    maxPrice: row.max_price as number | null,
    maxProductsPerRun: row.max_products_per_run as number,
    categories,
  };
}

export function updateAutoDiscoveryConfig(config: Partial<AutoDiscoveryConfig>): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (config.enabled !== undefined) {
    sets.push('enabled = ?');
    params.push(config.enabled ? 1 : 0);
  }
  if (config.intervalMinutes !== undefined) {
    sets.push('interval_minutes = ?');
    params.push(config.intervalMinutes);
  }
  if (config.minDiscount !== undefined) {
    sets.push('min_discount = ?');
    params.push(config.minDiscount);
  }
  if (config.freeShippingOnly !== undefined) {
    sets.push('free_shipping_only = ?');
    params.push(config.freeShippingOnly ? 1 : 0);
  }
  if (config.maxPrice !== undefined) {
    sets.push('max_price = ?');
    params.push(config.maxPrice);
  }
  if (config.maxProductsPerRun !== undefined) {
    sets.push('max_products_per_run = ?');
    params.push(config.maxProductsPerRun);
  }
  if (config.categories !== undefined) {
    sets.push('categories = ?');
    params.push(JSON.stringify(config.categories));
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  db.run(`UPDATE auto_discovery_config SET ${sets.join(', ')} WHERE id = 1`, params);
  saveDatabase();
}
