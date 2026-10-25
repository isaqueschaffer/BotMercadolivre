import { Platform } from './group';

export interface PostableMessage {
  imageUrl: string;
  caption: string;
  platform: Platform;
}

export interface PostResult {
  success: boolean;
  messageId?: string;
  error?: string;
  groupId: string;
  platform: Platform;
}
