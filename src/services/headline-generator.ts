import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../db/ai-config.repo';

const SYSTEM_PROMPT = `Você cria frases de abertura (headlines) curtas e espertas para posts de ofertas de afiliados em grupos de Telegram/WhatsApp brasileiros.

Regras:
- Receba o nome de um produto e devolva APENAS uma frase curta (4 a 8 palavras) relacionada a ele.
- A frase deve ser esperta, engraçada, com referência cultural, emocional ou de uso real do produto — NUNCA uma descrição do produto.
- Não repita o nome do produto literalmente na frase.
- Não use emojis, aspas, pontuação final ou qualquer explicação. Responda só com a frase.
- Tom casual, brasileiro, de closer de vendas de grupo de ofertas.

Exemplos:
Produto: Camisa Seleção Argentina Titular 2024
Frase: O Messi que indicou

Produto: Tênis Nike Revolution 6 Masculino
Frase: Eu sei que você tá precisando de um tênis

Produto: Bola de Futebol Society Penalty
Frase: Para usar na pelada de sábado

Produto: Fone de Ouvido Bluetooth JBL
Frase: Pra fingir que não ouviu o chefe chamando

Produto: Air Fryer Mondial 4L
Frase: Aquele fim de ano que você jurou que ia comer melhor

Produto: Perfume Importado Masculino
Frase: Pra passar confiança sem precisar falar nada`;

export async function generateHeadline(
  title: string,
  category?: string | null
): Promise<string | null> {
  try {
    return await generateHeadlineOrThrow(title, category);
  } catch (err: any) {
    console.error(`[Headline] Erro ao gerar com IA:`, err?.message || err);
    return null;
  }
}

export async function generateHeadlineOrThrow(
  title: string,
  _category?: string | null
): Promise<string> {
  const config = getAIConfig();

  let apiKey: string | null = null;
  let model = '';

  if (config.provider === 'anthropic') {
    apiKey = config.anthropicApiKey;
    model = config.anthropicModel;
  } else if (config.provider === 'openai') {
    apiKey = config.openaiApiKey;
    model = config.openaiModel;
  } else if (config.provider === 'gemini') {
    apiKey = config.geminiApiKey;
    model = config.geminiModel;
  }

  if (!apiKey) {
    throw new Error(`Chave de API do provedor '${config.provider}' não configurada. Configure na aba IA.`);
  }

  let headline: string | null = null;
  if (config.provider === 'anthropic') {
    headline = await generateWithAnthropic(title, apiKey, model);
  } else if (config.provider === 'openai') {
    headline = await generateWithOpenAI(title, apiKey, model);
  } else if (config.provider === 'gemini') {
    headline = await generateWithGemini(title, apiKey, model);
  } else {
    throw new Error(`Provedor de IA desconhecido: '${config.provider}'`);
  }

  if (!headline) {
    throw new Error(`O provedor '${config.provider}' (${model}) não retornou uma resposta válida.`);
  }

  return headline;
}

async function generateWithAnthropic(
  title: string,
  apiKey: string | null,
  model: string
): Promise<string | null> {
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Produto: ${title}` }],
  });

  const block = response.content.find((b) => b.type === 'text');
  const headline = block && block.type === 'text' ? block.text.trim().replace(/^["'«»“”\s]+|["'«»“”\s]+$/g, '') : null;
  return headline || null;
}

async function generateWithOpenAI(
  title: string,
  apiKey: string | null,
  model: string
): Promise<string | null> {
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Produto: ${title}` },
    ],
  });

  const headline = response.choices[0]?.message?.content?.trim().replace(/^["'«»“”\s]+|["'«»“”\s]+$/g, '');
  return headline || null;
}

async function generateWithGemini(
  title: string,
  apiKey: string | null,
  model: string
): Promise<string | null> {
  if (!apiKey) return null;

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: `Produto: ${title}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 300,
    },
  });

  const headline = response.text?.trim().replace(/^["'«»“”\s]+|["'«»“”\s]+$/g, '');
  return headline || null;
}
