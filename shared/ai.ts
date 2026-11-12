export const AI_PROVIDERS = ['cloudflare', 'gemini', 'deepseek', 'openai_compatible'] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  description: string;
  defaultModel: string;
  suggestedModels: string[];
  requiresApiKey: boolean;
  requiresBaseUrl?: boolean;
}

export const AI_PROVIDER_CATALOG: AiProviderInfo[] = [
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI',
    description: 'Lalai portal. Berjalan pada edge Cloudflare tanpa kunci API tambahan.',
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    suggestedModels: [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/google/gemma-3-12b-it'
    ],
    requiresApiKey: false
  },
  {
    id: 'gemini',
    label: 'Google Gemini (BYOK)',
    description: 'Guna kunci API Google AI Studio sendiri. Sesuai untuk analisis lebih mendalam.',
    defaultModel: 'gemini-2.0-flash',
    suggestedModels: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    requiresApiKey: true
  },
  {
    id: 'deepseek',
    label: 'DeepSeek (BYOK)',
    description: 'Guna kunci API DeepSeek. Kos efektif untuk penjanaan teks panjang.',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    requiresApiKey: true
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI-Compatible (BYOK)',
    description: 'Mana-mana endpoint /chat/completions serasi OpenAI (OpenRouter, Groq, Ollama, dll.).',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o-mini', 'llama-3.3-70b-versatile', 'qwen2.5:7b'],
    requiresApiKey: true,
    requiresBaseUrl: true
  }
];

export function getAiProviderInfo(provider: AiProvider): AiProviderInfo {
  return AI_PROVIDER_CATALOG.find((item) => item.id === provider) ?? AI_PROVIDER_CATALOG[0];
}

export interface AiSettingsDTO {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  encryptionReady: boolean;
  providers: AiProviderInfo[];
}

export interface UpdateAiSettingsInput {
  provider: AiProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface AiHierarchy {
  elimination?: string;
  substitution?: string;
  engineering?: string;
  administrative?: string;
  ppe?: string;
}

export type AiSuggestionSource =
  | 'cloudflare_workers_ai'
  | 'gemini'
  | 'deepseek'
  | 'openai_compatible'
  | 'local_dosh_ai_engine';

export interface AiSuggestionResultDTO {
  success: boolean;
  suggestion: string;
  hierarchy?: AiHierarchy;
  source: AiSuggestionSource;
  provider: AiProvider;
  model: string;
  cached?: boolean;
  warning?: string;
}

export function riskLevelFromScore(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 15) return 'High';
  if (score >= 5) return 'Medium';
  return 'Low';
}
