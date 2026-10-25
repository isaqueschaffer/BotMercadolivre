import { getDb, saveDatabase } from './database';
import { Schedule } from '../types/schedule';

function rowToSchedule(columns: string[], values: unknown[]): Schedule {
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return {
    id: row.id as number,
    cronExpression: row.cron_expression as string,
    label: row.label as string,
    enabled: Boolean(row.enabled),
    marketplace: row.marketplace as string | null,
    createdAt: row.created_at as string,
  };
}

export function insertSchedule(cronExpression: string, label = ''): number {
  const db = getDb();
  db.run(
    'INSERT INTO schedules (cron_expression, label) VALUES (?, ?)',
    [cronExpression, label]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  saveDatabase();
  return result[0]?.values[0]?.[0] as number;
}

export function getEnabledSchedules(): Schedule[] {
  const db = getDb();
  const result = db.exec('SELECT * FROM schedules WHERE enabled = 1');
  if (!result[0]) return [];
  return result[0].values.map(v => rowToSchedule(result[0].columns, v));
}

export function getAllSchedules(): Schedule[] {
  const db = getDb();
  const result = db.exec('SELECT * FROM schedules ORDER BY created_at DESC');
  if (!result[0]) return [];
  return result[0].values.map(v => rowToSchedule(result[0].columns, v));
}

export function toggleSchedule(id: number, enabled: boolean): void {
  const db = getDb();
  db.run('UPDATE schedules SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  saveDatabase();
}

export function deleteSchedule(id: number): void {
  const db = getDb();
  db.run('DELETE FROM schedules WHERE id = ?', [id]);
  saveDatabase();
}

export function disableAllSchedules(): void {
  const db = getDb();
  db.run('UPDATE schedules SET enabled = 0');
  saveDatabase();
}
