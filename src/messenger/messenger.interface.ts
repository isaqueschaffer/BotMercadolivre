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
  /**
   * @param fullLogout quando true, desloga de verdade e limpa a sessão salva
   * (uso do dashboard para trocar de conta). Quando false/omitido, apenas
   * encerra a conexão de forma limpa preservando a sessão (uso em shutdown
   * do processo/restart do servidor).
   */
  disconnect(fullLogout?: boolean): Promise<void>;
  getAvailableGroups?(): Promise<AvailableGroup[]>;
  getQrCode?(): string | null;
}
