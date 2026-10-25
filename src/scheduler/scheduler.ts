import { executePost } from '../services/posting-service';
import { MessengerProvider } from '../messenger/messenger.interface';
import { MarketplaceProvider } from '../marketplace/marketplace.interface';
import { getPostingConfig } from '../db/posting-config.repo';

let timer: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = 0;

export function startScheduler(
  messengers: MessengerProvider[],
  marketplace: MarketplaceProvider
): void {
  stopAllJobs();

  const config = getPostingConfig();
  if (!config.enabled || config.intervalMinutes <= 0) {
    console.log('[Scheduler] Postagem automática desativada.');
    return;
  }

  currentIntervalMs = config.intervalMinutes * 60 * 1000;

  timer = setInterval(async () => {
    console.log(`[Scheduler] Executando postagem automática (a cada ${config.intervalMinutes}min)...`);
    try {
      await executePost(messengers, marketplace);
    } catch (err) {
      console.error('[Scheduler] Erro na postagem:', err);
    }
  }, currentIntervalMs);

  console.log(`[Scheduler] Postagem automática ativada: a cada ${config.intervalMinutes} minuto(s).`);
}

export function restartScheduler(
  messengers: MessengerProvider[],
  marketplace: MarketplaceProvider
): void {
  stopAllJobs();
  startScheduler(messengers, marketplace);
}

export function stopAllJobs(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  currentIntervalMs = 0;
}

export function isSchedulerRunning(): boolean {
  return timer !== null;
}

export function getCurrentIntervalMs(): number {
  return currentIntervalMs;
}
