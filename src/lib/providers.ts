// ============================================================================
// providers — Expanded multi-provider registry with auto-rotation engine
// Phase 10: 15+ free-tier providers, 429/quota failover state machine
// ============================================================================

import type { ChatMessage, ProviderResponse, ProviderError } from '@/types';

// ---------------------------------------------------------------------------
// Provider catalog — built-in definitions with signup links & model lists
// ---------------------------------------------------------------------------

export type ApiFlavor = 'openai' | 'gemini' | 'cohere';

export interface ProviderDefinition {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  models: string[];
  signupUrl: string;
  flavor: ApiFlavor;
  freeTier: boolean;
}

export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    id: 'openai-default',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    signupUrl: 'https://platform.openai.com/api-keys',
    flavor: 'openai',
    freeTier: false,
  },
  {
    id: 'anthropic-default',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    signupUrl: 'https://console.anthropic.com/settings/keys',
    flavor: 'openai',
    freeTier: false,
  },
  {
    id: 'gemini-default',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemma-3-27b-it'],
    signupUrl: 'https://aistudio.google.com/apikey',
    flavor: 'gemini',
    freeTier: true,
  },
  {
    id: 'groq-default',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'qwen-2.5-32b', 'openai-gpt-oss-20b'],
    signupUrl: 'https://console.groq.com/keys',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'openrouter-default',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-chat-v3-0324:free',
    models: [
      'deepseek/deepseek-chat-v3-0324:free',
      'anthropic/claude-3.5-sonnet:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
    ],
    signupUrl: 'https://openrouter.ai/keys',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'mistral-default',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    models: ['mistral-small-latest', 'mistral-large-latest', 'codestral-latest'],
    signupUrl: 'https://console.mistral.ai/api-keys',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'cerebras-default',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
    signupUrl: 'https://cloud.cerebras.ai/apikeys',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'github-models-default',
    name: 'GitHub Models',
    baseUrl: 'https://models.inference.ai.azure.com',
    model: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'Phi-3.5-MoE-instruct', 'Meta-Llama-3.3-70B-Instruct'],
    signupUrl: 'https://github.com/settings/tokens',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'deepseek-default',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    signupUrl: 'https://platform.deepseek.com/api_keys',
    flavor: 'openai',
    freeTier: false,
  },
  {
    id: 'cohere-default',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    model: 'command-r7b-12-2024',
    models: ['command-r7b-12-2024', 'command-r-plus-08-2024'],
    signupUrl: 'https://dashboard.cohere.com/api-keys',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'nvidia-nim-default',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    signupUrl: 'https://build.nvidia.com',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'cloudflare-default',
    name: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    models: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen2.5-coder-32b-instruct'],
    signupUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    flavor: 'openai',
    freeTier: true,
  },
  {
    id: 'huggingface-default',
    name: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    models: ['meta-llama/Llama-3.3-70B-Instruct', 'Qwen/Qwen2.5-72B-Instruct'],
    signupUrl: 'https://huggingface.co/settings/tokens',
    flavor: 'openai',
    freeTier: true,
  },
];

const STORAGE_KEY = 'omnifree-providers';

export function loadProviders(): ProviderConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ProviderConfig[];
      // Fill in any newly added catalog providers the user doesn't have yet
      const known = new Set(parsed.map((p) => p.id));
      const missing = PROVIDER_CATALOG.filter((d) => !known.has(d.id)).map((d) => ({
        id: d.id,
        name: d.name,
        apiKey: '',
        baseUrl: d.baseUrl,
        model: d.model,
        enabled: false,
        priority: d.freeTier ? 1 : 5,
      }));
      return [...parsed, ...missing];
    }
    return PROVIDER_CATALOG.map((d) => ({
      id: d.id,
      name: d.name,
      apiKey: '',
      baseUrl: d.baseUrl,
      model: d.model,
      enabled: false,
      priority: d.freeTier ? 1 : 5,
    }));
  } catch {
    return PROVIDER_CATALOG.map((d) => ({
      id: d.id,
      name: d.name,
      apiKey: '',
      baseUrl: d.baseUrl,
      model: d.model,
      enabled: false,
      priority: d.freeTier ? 1 : 5,
    }));
  }
}

export function saveProviders(providers: ProviderConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

export function getDefinition(id: string): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((d) => d.id === id);
}

export function getEnabledProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers
    .filter((p) => p.enabled && p.apiKey.trim().length > 0)
    .sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// Rotation state machine — persists last-used provider (Phase 10)
// ---------------------------------------------------------------------------

const LAST_PROVIDER_KEY = 'omnifree-last-provider';

export function getLastUsedProviderId(): string {
  return localStorage.getItem(LAST_PROVIDER_KEY) ?? '';
}

function setLastUsedProviderId(id: string): void {
  localStorage.setItem(LAST_PROVIDER_KEY, id);
}

export interface RotationEvent {
  failedProviderId: string;
  failedProviderName: string;
  reason: string;
  nextProviderName: string;
}

export interface SendOptions {
  signal: AbortSignal;
  /** When set, locks the request to one provider (Manual Mode). */
  manualProviderId?: string;
  onRotation?: (event: RotationEvent) => void;
}

function isRateLimitError(status: number): boolean {
  return status === 429 || status === 402 || status === 403;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible callers (also used by OpenRouter, Groq, Mistral, etc.)
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content };
    }
    return {
      role: m.role,
      content: m.content.map((part) =>
        part.type === 'text'
          ? { type: 'text', text: part.text }
          : { type: 'image_url', image_url: { url: part.imageUrl } },
      ),
    };
  });
}

async function callOpenAICompatible(
  provider: ProviderConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResponse> {
  const start = performance.now();
  const url = `${provider.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.id.startsWith('anthropic')) {
    headers['anthropic-version'] = '2023-06-01';
  }
  if (provider.id.startsWith('openrouter')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'OmniFree AI Studio';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: provider.model, messages: toOpenAIMessages(messages), max_tokens: 2048, temperature: 0.7 }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    const error: ProviderError = {
      providerId: provider.id,
      providerName: provider.name,
      message: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      status: response.status,
    };
    throw error;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    providerId: provider.id,
    providerName: provider.name,
    model: provider.model,
    elapsedMs: Math.round(performance.now() - start),
  };
}

// ---------------------------------------------------------------------------
// Gemini native caller
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

function toGeminiContents(messages: ChatMessage[]): Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> {
  return messages.map((m) => {
    const parts: GeminiPart[] = [];
    if (typeof m.content === 'string') {
      parts.push({ text: m.content });
    } else {
      for (const part of m.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else {
          const match = part.imageUrl.match(/^data:([^;]+);base64,(.*)$/);
          if (match) {
            parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
          } else {
            parts.push({ text: '[image]' });
          }
        }
      }
    }
    return { role: m.role === 'assistant' ? ('model' as const) : ('user' as const), parts };
  });
}

async function callGemini(
  provider: ProviderConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResponse> {
  const start = performance.now();
  const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const systemText = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const body: Record<string, unknown> = {
    contents: toGeminiContents(nonSystem),
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  };
  if (systemText && typeof systemText.content === 'string') {
    body.systemInstruction = { parts: [{ text: systemText.content }] };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    const error: ProviderError = {
      providerId: provider.id,
      providerName: provider.name,
      message: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      status: response.status,
    };
    throw error;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return {
    text,
    providerId: provider.id,
    providerName: provider.name,
    model: provider.model,
    elapsedMs: Math.round(performance.now() - start),
  };
}

// ---------------------------------------------------------------------------
// Auto-rotation & failover router
// ---------------------------------------------------------------------------

export async function sendChatWithFallback(
  providers: ProviderConfig[],
  messages: ChatMessage[],
  signal: AbortSignal,
  options?: { manualProviderId?: string; onRotation?: (event: RotationEvent) => void },
): Promise<ProviderResponse> {
  const manualId = options?.manualProviderId;
  const onRotation = options?.onRotation;

  // Manual lock mode: only try the pinned provider
  if (manualId) {
    const provider = providers.find((p) => p.id === manualId && p.apiKey.trim());
    if (!provider) {
      throw {
        providerId: 'none',
        providerName: 'none',
        message: 'Selected provider has no API key configured.',
      } as ProviderError;
    }
    const response = await callProvider(provider, messages, signal);
    setLastUsedProviderId(provider.id);
    return response;
  }

  const enabled = getEnabledProviders(providers);
  if (enabled.length === 0) {
    throw {
      providerId: 'none',
      providerName: 'none',
      message: 'No providers configured. Add an API key in Provider Settings.',
    } as ProviderError;
  }

  // Start from the last successfully used provider, then rotate through the rest
  const lastId = getLastUsedProviderId();
  const queue = [...enabled].sort((a, b) => {
    if (a.id === lastId) return -1;
    if (b.id === lastId) return 1;
    return a.priority - b.priority;
  });

  let lastError: ProviderError | null = null;
  for (let i = 0; i < queue.length; i++) {
    const provider = queue[i];
    try {
      const response = await callProvider(provider, messages, signal);
      setLastUsedProviderId(provider.id);
      return response;
    } catch (err) {
      if (signal.aborted) throw err;
      let providerError: ProviderError;
      if (err instanceof Error) {
        providerError = {
          providerId: provider.id,
          providerName: provider.name,
          message: err.message,
        };
      } else {
        providerError = err as ProviderError;
      }
      lastError = providerError;

      const next = queue[i + 1];
      if (next && onRotation) {
        onRotation({
          failedProviderId: provider.id,
          failedProviderName: provider.name,
          reason: providerError.status
            ? isRateLimitError(providerError.status)
              ? 'rate limit'
              : `HTTP ${providerError.status}`
            : 'network error',
          nextProviderName: next.name,
        });
      }
    }
  }
  throw lastError ?? ({ providerId: 'none', providerName: 'none', message: 'All providers failed' } as ProviderError);
}

async function callProvider(
  provider: ProviderConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResponse> {
  const definition = getDefinition(provider.id);
  if (definition?.flavor === 'gemini') {
    return callGemini(provider, messages, signal);
  }
  return callOpenAICompatible(provider, messages, signal);
}
