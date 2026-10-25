import { PostableMessage, PostResult } from '../types/message';
import { Platform } from '../types/group';

export interface AvailableGroup {
  id: string;
  name: string;
}

export interface MessengerProvider {
  readonly platform: Platform;
  initialize(): Promise<void>;
  sendProductPost(groupId: string, message: PostableMessage): Promise<PostResult>;
  isConnected(): boolean;
  isInitialized?(): boolean;
  disconnect(): Promise<void>;
  getAvailableGroups?(): Promise<AvailableGroup[]>;
  getQrCode?(): string | null;
}
