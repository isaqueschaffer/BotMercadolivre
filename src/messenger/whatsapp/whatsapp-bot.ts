import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { MessengerProvider, AvailableGroup } from '../messenger.interface';
import { PostableMessage, PostResult } from '../../types/message';
import { handleWhatsAppCommand } from './whatsapp-commands';
import { config } from '../../config';

const AUTH_DIR = path.resolve('./auth/whatsapp');

export class WhatsAppBot implements MessengerProvider {
  readonly platform = 'whatsapp' as const;
  private socket: WASocket | null = null;
  private connected = false;
  private initialized = false;
  private latestQr: string | null = null;

  hasExistingAuth(): boolean {
    try {
      return fs.existsSync(path.join(AUTH_DIR, 'creds.json'));
    } catch {
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.latestQr = qr;
        console.log('[WhatsApp] QR code gerado. Escaneie para conectar.');
      }

      if (connection === 'open') {
        this.connected = true;
        this.latestQr = null;
        console.log('[WhatsApp] Conectado com sucesso!');
      }

      if (connection === 'close') {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          this.initialized = false;
          console.log('[WhatsApp] Deslogado. Reconecte pelo dashboard.');
        } else {
          console.log('[WhatsApp] Desconectado. Reconectando...');
          this.initialized = false;
          this.initialize();
        }
      }
    });

    this.socket.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if (!text || !text.startsWith('!')) continue;

        const sender = msg.key.remoteJid || '';
        const senderNumber = msg.key.participant || sender.replace('@s.whatsapp.net', '');

        if (!config.whatsapp.adminNumbers.includes(senderNumber.replace('@s.whatsapp.net', ''))) continue;

        const reply = handleWhatsAppCommand(text);
        if (reply && this.socket) {
          await this.socket.sendMessage(sender, { text: reply });
        }
      }
    });
  }

  async sendProductPost(groupId: string, message: PostableMessage): Promise<PostResult> {
    if (!this.socket || !this.connected) {
      return { success: false, error: 'WhatsApp not connected', groupId, platform: 'whatsapp' };
    }

    try {
      const imageBuffer = await this.downloadImage(message.imageUrl);

      const sent = await this.socket.sendMessage(groupId, {
        image: imageBuffer,
        caption: message.caption,
      });

      return {
        success: true,
        messageId: sent?.key.id || undefined,
        groupId,
        platform: 'whatsapp',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[WhatsApp] Erro ao enviar para ${groupId}:`, errorMsg);

      try {
        const sent = await this.socket!.sendMessage(groupId, { text: message.caption });
        return {
          success: true,
          messageId: sent?.key.id || undefined,
          groupId,
          platform: 'whatsapp',
        };
      } catch (fallbackErr: unknown) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return {
          success: false,
          error: fallbackMsg,
          groupId,
          platform: 'whatsapp',
        };
      }
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getQrCode(): string | null {
    return this.latestQr;
  }

  async getAvailableGroups(): Promise<AvailableGroup[]> {
    if (!this.socket || !this.connected) return [];
    try {
      const groups = await this.socket.groupFetchAllParticipating();
      return Object.values(groups).map(g => ({
        id: g.id,
        name: g.subject,
      }));
    } catch {
      return [];
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.connected = false;
      this.initialized = false;
      console.log('[WhatsApp] Desconectado.');
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(response.data);
  }
}
