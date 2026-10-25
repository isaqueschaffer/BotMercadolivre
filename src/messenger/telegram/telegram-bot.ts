import { Bot, InputFile } from 'grammy';
import axios from 'axios';
import { config } from '../../config';
import { MessengerProvider, AvailableGroup } from '../messenger.interface';
import { PostableMessage, PostResult } from '../../types/message';
import { registerCommands, registerAdvancedCommands, SetMessengersFn } from './telegram-commands';

let bot: Bot;
const knownGroups = new Map<string, string>();

export class TelegramBot implements MessengerProvider {
  readonly platform = 'telegram' as const;
  private running = false;
  private setMessengersFn: SetMessengersFn | null = null;

  constructor(
    private marketplace?: import('../../marketplace/marketplace.interface').MarketplaceProvider,
  ) {}

  async initialize(): Promise<void> {
    bot = new Bot(config.telegram.botToken);

    bot.on('message', (ctx, next) => {
      const chat = ctx.chat;
      if (chat.type === 'group' || chat.type === 'supergroup') {
        knownGroups.set(String(chat.id), chat.title || `Grupo ${chat.id}`);
      }
      return next();
    });

    bot.on('my_chat_member', (ctx) => {
      const chat = ctx.chat;
      if (chat.type === 'group' || chat.type === 'supergroup') {
        const status = ctx.myChatMember.new_chat_member.status;
        if (status === 'member' || status === 'administrator') {
          knownGroups.set(String(chat.id), chat.title || `Grupo ${chat.id}`);
        } else if (status === 'left' || status === 'kicked') {
          knownGroups.delete(String(chat.id));
        }
      }
    });

    registerCommands(bot);

    if (this.marketplace) {
      this.setMessengersFn = registerAdvancedCommands(bot, this.marketplace);
    }

    bot.start();
    this.running = true;
    const me = await bot.api.getMe();
    console.log(`[Telegram] Bot @${me.username} conectado.`);
  }

  setMessengers(messengers: MessengerProvider[]): void {
    if (this.setMessengersFn) this.setMessengersFn(messengers);
  }

  async sendProductPost(groupId: string, message: PostableMessage): Promise<PostResult> {
    try {
      const imageBuffer = await this.downloadImage(message.imageUrl);

      const sent = await bot.api.sendPhoto(
        groupId,
        new InputFile(imageBuffer, 'product.jpg'),
        {
          caption: message.caption,
          parse_mode: 'HTML',
        }
      );

      return {
        success: true,
        messageId: String(sent.message_id),
        groupId,
        platform: 'telegram',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Telegram] Erro ao enviar para ${groupId}:`, errorMsg);

      try {
        const sent = await bot.api.sendMessage(groupId, message.caption, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        return {
          success: true,
          messageId: String(sent.message_id),
          groupId,
          platform: 'telegram',
        };
      } catch (fallbackErr: unknown) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return {
          success: false,
          error: fallbackMsg,
          groupId,
          platform: 'telegram',
        };
      }
    }
  }

  isConnected(): boolean {
    return this.running;
  }

  async getAvailableGroups(): Promise<AvailableGroup[]> {
    return Array.from(knownGroups.entries()).map(([id, name]) => ({ id, name }));
  }

  async disconnect(): Promise<void> {
    if (bot) {
      await bot.stop();
      this.running = false;
      console.log('[Telegram] Bot desconectado.');
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(response.data);
  }
}

export function getBotInstance(): Bot {
  return bot;
}
