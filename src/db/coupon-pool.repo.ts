import { getDb, saveDatabase } from './database';

export interface PoolCoupon {
  id: number;
  campaignId: string;
  categoryTitle: string | null;
  code: string | null;
  actionLink: string | null;
  title: string | null;
}

export interface NewPoolCoupon {
  campaignId: string;
  categoryTitle: string | null;
  code: string | null;
  actionLink: string | null;
  title: string | null;
  minAmountText: string | null;
  capAmountText: string | null;
  expirationText: string | null;
}

/** Insere o cupom no pool (ignora se já existir pelo campaignId) e retorna o id da linha. */
export function upsertCouponToPool(c: NewPoolCoupon): number {
  const db = getDb();
  db.run(
    `INSERT OR IGNORE INTO coupon_pool
     (campaign_id, category_title, code, action_link, title, min_amount_text, cap_amount_text, expiration_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.campaignId, c.categoryTitle, c.code, c.actionLink, c.title, c.minAmountText, c.capAmountText, c.expirationText]
  );
  const result = db.exec('SELECT id FROM coupon_pool WHERE campaign_id = ?', [c.campaignId]);
  saveDatabase();
  return result[0]?.values[0]?.[0] as number;
}

/** Retorna o cupom disponível mais antigo cuja categoria combine (comparação feita pelo chamador). */
export function getAvailableCoupons(): PoolCoupon[] {
  const db = getDb();
  const result = db.exec('SELECT * FROM coupon_pool WHERE consumed = 0 ORDER BY imported_at ASC');
  if (!result[0]) return [];

  const columns = result[0].columns;
  return result[0].values.map(values => {
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    return {
      id: row.id as number,
      campaignId: row.campaign_id as string,
      categoryTitle: row.category_title as string | null,
      code: row.code as string | null,
      actionLink: row.action_link as string | null,
      title: row.title as string | null,
    };
  });
}

export function markCouponConsumed(id: number, productId: number): void {
  const db = getDb();
  db.run('UPDATE coupon_pool SET consumed = 1, consumed_product_id = ? WHERE id = ?', [productId, id]);
  saveDatabase();
}

export function getPoolStats(): { available: number; consumed: number } {
  const db = getDb();
  const result = db.exec('SELECT consumed, COUNT(*) FROM coupon_pool GROUP BY consumed');
  const stats = { available: 0, consumed: 0 };
  if (!result[0]) return stats;
  for (const [consumed, count] of result[0].values) {
    if (consumed === 0) stats.available = count as number;
    else stats.consumed = count as number;
  }
  return stats;
}
