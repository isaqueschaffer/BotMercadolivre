export type Platform = 'telegram' | 'whatsapp';

export interface TargetGroup {
  id: number;
  platform: Platform;
  groupId: string;
  groupName: string;
  enabled: boolean;
  addedAt: string;
}
