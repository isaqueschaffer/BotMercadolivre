import { getDb, saveDatabase } from './database';

export interface PostingConfig {
  enabled: boolean;
  intervalMinutes: number;
}

export function getPostingConfig(): PostingConfig {
  const db = getDb();
  const result = db.exec('SELECT * FROM posting_config WHERE id = 1');
  if (!result[0] || result[0].values.length === 0) {
    return { enabled: false, intervalMinutes: 30 };
  }

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });

  return {
    enabled: Boolean(row.enabled),
    intervalMinutes: row.interval_minutes as number,
  };
}

export function updatePostingConfig(config: Partial<PostingConfig>): void {
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

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  db.run(`UPDATE posting_config SET ${sets.join(', ')} WHERE id = 1`, params);
  saveDatabase();
}
