import { Database } from 'sql.js';

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id     TEXT NOT NULL,
      marketplace     TEXT NOT NULL DEFAULT 'mercadolivre',
      title           TEXT NOT NULL,
      price           REAL NOT NULL,
      original_price  REAL,
      currency        TEXT NOT NULL DEFAULT 'BRL',
      image_url       TEXT NOT NULL,
      product_url     TEXT NOT NULL,
      affiliate_url   TEXT,
      category        TEXT,
      condition_type  TEXT,
      sold_quantity   INTEGER,
      free_shipping   INTEGER NOT NULL DEFAULT 0,
      headline        TEXT,
      coupon_code     TEXT,
      source          TEXT NOT NULL DEFAULT 'auto',
      status          TEXT NOT NULL DEFAULT 'pending',
      added_at        TEXT NOT NULL DEFAULT (datetime('now')),
      posted_at       TEXT,
      discount_percent REAL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      UNIQUE(external_id, marketplace)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      cron_expression TEXT NOT NULL,
      label           TEXT NOT NULL DEFAULT '',
      enabled         INTEGER NOT NULL DEFAULT 1,
      marketplace     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS target_groups (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      platform        TEXT NOT NULL,
      group_id        TEXT NOT NULL,
      group_name      TEXT NOT NULL DEFAULT '',
      enabled         INTEGER NOT NULL DEFAULT 1,
      added_at        TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, group_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS post_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL REFERENCES products(id),
      platform        TEXT NOT NULL,
      group_id        TEXT NOT NULL,
      message_id      TEXT,
      posted_at       TEXT NOT NULL DEFAULT (datetime('now')),
      success         INTEGER NOT NULL DEFAULT 1,
      error_message   TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ml_tokens (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      access_token    TEXT NOT NULL,
      refresh_token   TEXT NOT NULL,
      expires_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS auto_discovery_config (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      enabled         INTEGER NOT NULL DEFAULT 0,
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      min_discount    INTEGER NOT NULL DEFAULT 10,
      free_shipping_only INTEGER NOT NULL DEFAULT 0,
      max_price       REAL,
      max_products_per_run INTEGER NOT NULL DEFAULT 10,
      categories      TEXT NOT NULL DEFAULT '[]',
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`INSERT OR IGNORE INTO auto_discovery_config (id) VALUES (1)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS posting_config (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      enabled         INTEGER NOT NULL DEFAULT 0,
      interval_minutes INTEGER NOT NULL DEFAULT 30,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`INSERT OR IGNORE INTO posting_config (id) VALUES (1)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS coupon_import_config (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      max_per_run     INTEGER NOT NULL DEFAULT 20,
      last_run_at     TEXT,
      last_status     TEXT,
      last_count      INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`INSERT OR IGNORE INTO coupon_import_config (id) VALUES (1)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      provider        TEXT NOT NULL DEFAULT 'anthropic',
      anthropic_api_key TEXT,
      anthropic_model TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
      openai_api_key  TEXT,
      openai_model    TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      gemini_api_key  TEXT,
      gemini_model    TEXT NOT NULL DEFAULT 'gemini-flash-latest',
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`INSERT OR IGNORE INTO ai_config (id) VALUES (1)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS marketplace_config (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      shopee_app_id      TEXT,
      shopee_secret      TEXT,
      amazon_partner_tag TEXT,
      amazon_access_key  TEXT,
      amazon_secret_key  TEXT,
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`INSERT OR IGNORE INTO marketplace_config (id) VALUES (1)`);

  try { db.run('ALTER TABLE products ADD COLUMN headline TEXT'); } catch {}
  try { db.run('ALTER TABLE products ADD COLUMN coupon_code TEXT'); } catch {}
  try { db.run('ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0'); } catch {}

  db.run('CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products(marketplace)');
  db.run('CREATE INDEX IF NOT EXISTS idx_post_history_product ON post_history(product_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_post_history_group ON post_history(platform, group_id)');
}
