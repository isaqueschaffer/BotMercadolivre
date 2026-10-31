import { getDb, saveDatabase } from './database';

export interface CouponImportConfig {
  maxPerRun: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastCount: number;
  lastAttached: number;
  lastPooled: number;
  lastError: string | null;
}

export function getCouponImportConfig(): CouponImportConfig {
  const db = getDb();
  const result = db.exec('SELECT * FROM coupon_import_config WHERE id = 1');
  if (!result[0] || result[0].values.length === 0) {
    return { maxPerRun: 20, lastRunAt: null, lastStatus: null, lastCount: 0, lastAttached: 0, lastPooled: 0, lastError: null };
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });

  return {
    maxPerRun: (row.max_per_run as number) || 20,
    lastRunAt: row.last_run_at as string | null,
    lastStatus: row.last_status as string | null,
    lastCount: (row.last_count as number) || 0,
    lastAttached: (row.last_attached as number) || 0,
    lastPooled: (row.last_pooled as number) || 0,
    lastError: row.last_error as string | null,
  };
}

export function updateCouponImportConfig(config: Partial<Pick<CouponImportConfig, 'maxPerRun'>>): void {
  const db = getDb();
  if (config.maxPerRun === undefined) return;

  db.run(
    `UPDATE coupon_import_config SET max_per_run = ?, updated_at = datetime('now') WHERE id = 1`,
    [config.maxPerRun]
  );
  saveDatabase();
}

export function recordCouponImportRun(status: 'ok' | 'error', attached: number, pooled: number, error: string | null): void {
  const db = getDb();
  db.run(
    `UPDATE coupon_import_config SET last_run_at = datetime('now'), last_status = ?, last_count = ?, last_attached = ?, last_pooled = ?, last_error = ? WHERE id = 1`,
    [status, attached + pooled, attached, pooled, error]
  );
  saveDatabase();
}
