import { getDb, saveDatabase } from './database';

export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface AIConfig {
  provider: AIProvider;
  anthropicApiKey: string | null;
  anthropicModel: string;
  openaiApiKey: string | null;
  openaiModel: string;
  geminiApiKey: string | null;
  geminiModel: string;
}

const DEFAULTS: AIConfig = {
  provider: 'anthropic',
  anthropicApiKey: null,
  anthropicModel: 'claude-haiku-4-5',
  openaiApiKey: null,
  openaiModel: 'gpt-4o-mini',
  geminiApiKey: null,
  geminiModel: 'gemini-flash-latest',
};

const COLUMN_MAP: Record<keyof AIConfig, string> = {
  provider: 'provider',
  anthropicApiKey: 'anthropic_api_key',
  anthropicModel: 'anthropic_model',
  openaiApiKey: 'openai_api_key',
  openaiModel: 'openai_model',
  geminiApiKey: 'gemini_api_key',
  geminiModel: 'gemini_model',
};

export function getAIConfig(): AIConfig {
  const db = getDb();
  const result = db.exec('SELECT * FROM ai_config WHERE id = 1');
  if (!result[0] || result[0].values.length === 0) return DEFAULTS;

  const columns = result[0].columns;
  const values = result[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => { row[col] = values[i]; });

  return {
    provider: (row.provider as AIProvider) || DEFAULTS.provider,
    anthropicApiKey: (row.anthropic_api_key as string) || null,
    anthropicModel: (row.anthropic_model as string) || DEFAULTS.anthropicModel,
    openaiApiKey: (row.openai_api_key as string) || null,
    openaiModel: (row.openai_model as string) || DEFAULTS.openaiModel,
    geminiApiKey: (row.gemini_api_key as string) || null,
    geminiModel: (row.gemini_model as string) || DEFAULTS.geminiModel,
  };
}

export function updateAIConfig(partial: Partial<AIConfig>): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const key of Object.keys(COLUMN_MAP) as (keyof AIConfig)[]) {
    const value = partial[key];
    if (value !== undefined) {
      sets.push(`${COLUMN_MAP[key]} = ?`);
      params.push(value);
    }
  }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  db.run(`UPDATE ai_config SET ${sets.join(', ')} WHERE id = 1`, params as any[]);
  saveDatabase();
}
