import { getDb, saveDatabase } from './database';
import { Platform } from '../types/group';

export interface PostHistoryEntry {
  id: number;
  productId: number;
  platform: Platform;
  groupId: string;
  messageId: string | null;
  postedAt: string;
  success: boolean;
  errorMessage: string | null;
}

export function recordPost(
  productId: number,
  platform: Platform,
  groupId: string,
  success: boolean,
  messageId?: string,
  errorMessage?: string
): void {
  const db = getDb();
  db.run(
    `INSERT INTO post_history (product_id, platform, group_id, message_id, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [productId, platform, groupId, messageId || null, success ? 1 : 0, errorMessage || null]
  );
  saveDatabase();
}

export function getPostCount(): number {
  const db = getDb();
  const result = db.exec('SELECT COUNT(*) FROM post_history WHERE success = 1');
  return (result[0]?.values[0]?.[0] as number) || 0;
}

export function getLastPostTime(): string | null {
  const db = getDb();
  const result = db.exec(
    'SELECT posted_at FROM post_history WHERE success = 1 ORDER BY posted_at DESC LIMIT 1'
  );
  return (result[0]?.values[0]?.[0] as string) || null;
}

export function wasPostedToGroup(productId: number, platform: Platform, groupId: string): boolean {
  const db = getDb();
  const result = db.exec(
    'SELECT COUNT(*) FROM post_history WHERE product_id = ? AND platform = ? AND group_id = ? AND success = 1',
    [productId, platform, groupId]
  );
  return ((result[0]?.values[0]?.[0] as number) || 0) > 0;
}
