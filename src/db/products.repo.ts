import { getDb, saveDatabase } from './database';
import { Product, ProductSource, ProductStatus } from '../types/product';

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as number,
    externalId: row.external_id as string,
    marketplace: row.marketplace as string,
    title: row.title as string,
    headline: row.headline as string | null,
    price: row.price as number,
    originalPrice: row.original_price as number | null,
    currency: row.currency as string,
    imageUrl: row.image_url as string,
    productUrl: row.product_url as string,
    affiliateUrl: row.affiliate_url as string | null,
    category: row.category as string | null,
    condition: row.condition_type as string | null,
    soldQuantity: row.sold_quantity as number | null,
    freeShipping: Boolean(row.free_shipping),
    couponCode: row.coupon_code as string | null,
    source: row.source as ProductSource,
    status: row.status as ProductStatus,
    addedAt: row.added_at as string,
    postedAt: row.posted_at as string | null,
    discountPercent: row.discount_percent as number | null,
    sortOrder: (row.sort_order as number) || 0,
  };
}

export function insertProduct(product: Omit<Product, 'id' | 'status' | 'addedAt' | 'postedAt' | 'sortOrder'>): number {
  const db = getDb();
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  db.run(
    `INSERT OR IGNORE INTO products
     (external_id, marketplace, title, headline, price, original_price, currency, image_url,
      product_url, affiliate_url, category, condition_type, sold_quantity,
      free_shipping, coupon_code, source, discount_percent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.externalId, product.marketplace, product.title, product.headline || null,
      product.price, product.originalPrice, product.currency, product.imageUrl,
      product.productUrl, product.affiliateUrl, product.category,
      product.condition, product.soldQuantity,
      product.freeShipping ? 1 : 0, product.couponCode || null, product.source, discount,
    ]
  );

  const result = db.exec('SELECT last_insert_rowid() as id');
  saveDatabase();
  return result[0]?.values[0]?.[0] as number;
}

export function getNextPending(): Product | null {
  const db = getDb();
  const result = db.exec(
    `SELECT * FROM products WHERE status = 'pending'
     ORDER BY sort_order DESC, source = 'manual' DESC, added_at ASC LIMIT 1`
  );
  if (!result[0] || result[0].values.length === 0) return null;

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return rowToProduct(row);
}

export function updateProductStatus(id: number, status: ProductStatus): void {
  const db = getDb();
  const postedAt = status === 'posted' ? "datetime('now')" : 'NULL';
  db.run(`UPDATE products SET status = ?, posted_at = ${postedAt} WHERE id = ?`, [status, id]);
  saveDatabase();
}

export function updateAffiliateUrl(id: number, affiliateUrl: string): void {
  const db = getDb();
  db.run('UPDATE products SET affiliate_url = ? WHERE id = ?', [affiliateUrl, id]);
  saveDatabase();
}

export function updateProductDetails(id: number, fields: { headline?: string | null; couponCode?: string | null }): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.headline !== undefined) { sets.push('headline = ?'); params.push(fields.headline); }
  if (fields.couponCode !== undefined) { sets.push('coupon_code = ?'); params.push(fields.couponCode); }

  if (sets.length === 0) return;
  params.push(id);
  db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, params);
  saveDatabase();
}

export function getProductById(id: number): Product | null {
  const db = getDb();
  const result = db.exec('SELECT * FROM products WHERE id = ?', [id]);
  if (!result[0] || result[0].values.length === 0) return null;

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return rowToProduct(row);
}

export function getPendingCount(): number {
  const db = getDb();
  const result = db.exec("SELECT COUNT(*) FROM products WHERE status = 'pending'");
  return (result[0]?.values[0]?.[0] as number) || 0;
}

export function getProductsByStatus(status: ProductStatus, limit = 10): Product[] {
  const db = getDb();
  const orderBy = status === 'pending'
    ? 'ORDER BY sort_order DESC, source = \'manual\' DESC, added_at ASC'
    : 'ORDER BY posted_at DESC, added_at DESC';
  const result = db.exec(
    `SELECT * FROM products WHERE status = ? ${orderBy} LIMIT ?`,
    [status, limit]
  );
  if (!result[0]) return [];

  const columns = result[0].columns;
  return result[0].values.map(values => {
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    return rowToProduct(row);
  });
}

export function moveProductToTop(id: number): void {
  const db = getDb();
  const result = db.exec("SELECT MAX(sort_order) FROM products WHERE status = 'pending'");
  const maxOrder = (result[0]?.values[0]?.[0] as number) || 0;
  db.run('UPDATE products SET sort_order = ? WHERE id = ?', [maxOrder + 1, id]);
  saveDatabase();
}

export function moveProductToBottom(id: number): void {
  const db = getDb();
  db.run('UPDATE products SET sort_order = 0 WHERE id = ?', [id]);
  saveDatabase();
}

export function productExists(externalId: string, marketplace: string): boolean {
  const db = getDb();
  const result = db.exec(
    'SELECT COUNT(*) FROM products WHERE external_id = ? AND marketplace = ?',
    [externalId, marketplace]
  );
  return ((result[0]?.values[0]?.[0] as number) || 0) > 0;
}
