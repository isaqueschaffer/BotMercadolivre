import { getDb, saveDatabase } from './database';
import { TargetGroup, Platform } from '../types/group';

function rowToGroup(columns: string[], values: unknown[]): TargetGroup {
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });
  return {
    id: row.id as number,
    platform: row.platform as Platform,
    groupId: row.group_id as string,
    groupName: row.group_name as string,
    enabled: Boolean(row.enabled),
    addedAt: row.added_at as string,
  };
}

export function insertGroup(platform: Platform, groupId: string, groupName: string): number {
  const db = getDb();
  db.run(
    'INSERT OR IGNORE INTO target_groups (platform, group_id, group_name) VALUES (?, ?, ?)',
    [platform, groupId, groupName]
  );
  const result = db.exec('SELECT last_insert_rowid() as id');
  saveDatabase();
  return result[0]?.values[0]?.[0] as number;
}

export function getEnabledGroups(platform?: Platform): TargetGroup[] {
  const db = getDb();
  const sql = platform
    ? 'SELECT * FROM target_groups WHERE enabled = 1 AND platform = ?'
    : 'SELECT * FROM target_groups WHERE enabled = 1';
  const result = db.exec(sql, platform ? [platform] : []);
  if (!result[0]) return [];
  return result[0].values.map(v => rowToGroup(result[0].columns, v));
}

export function getAllGroups(): TargetGroup[] {
  const db = getDb();
  const result = db.exec('SELECT * FROM target_groups ORDER BY platform, added_at DESC');
  if (!result[0]) return [];
  return result[0].values.map(v => rowToGroup(result[0].columns, v));
}

export function removeGroup(platform: Platform, groupId: string): boolean {
  const db = getDb();
  db.run('DELETE FROM target_groups WHERE platform = ? AND group_id = ?', [platform, groupId]);
  const result = db.exec('SELECT changes()');
  saveDatabase();
  return ((result[0]?.values[0]?.[0] as number) || 0) > 0;
}

export function toggleGroup(id: number, enabled: boolean): void {
  const db = getDb();
  db.run('UPDATE target_groups SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
  saveDatabase();
}
