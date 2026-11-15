// ============================================================================
// providers — Provider abstraction with auto-fallback router
// Phase 6: Custom Providers + Auto-Fallback Router
// ============================================================================

import type { ProviderConfig, ChatMessage, ProviderResponse, ProviderError } from '@/types';

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai-default',
    name: 'OpenAI',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    enabled: false,
    priority: 1,
  },
  {
    id: 'anthropic-default',
    name: 'Anthropic',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    enabled: false,
    priority: 2,
  },
  {
    id: 'groq-default',
    name: 'Groq',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    enabled: false,
    priority: 3,
  },
];

const STORAGE_KEY = 'omnifree-providers';

export function loadProviders(): ProviderConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ProviderConfig[];
      return parsed;
    }
  } catch {
    // fall through
  }
  return [...DEFAULT_PROVIDERS];
}

export function saveProviders(providers: ProviderConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

export function getEnabledProviders(providers: ProviderConfig[]): ProviderConfig[] {
  return providers
    .filter((p) => p.enabled && p.apiKey.trim().length > 0)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Sends a chat completion request to a single provider using OpenAI-compatible API.
 */
async function callProvider(
  provider: ProviderConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResponse> {
  const start = performance.now();
  const url = `${provider.baseUrl}/chat/completions`;

  // Anthropic uses a different header layout but supports OpenAI-compatible endpoint
  // via /v1/messages — we use the OpenAI-compatible format for simplicity here.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.id.startsWith('anthropic')) {
    headers['anthropic-version'] = '2023-06-01';
  }

  const body = JSON.stringify({
    model: provider.model,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
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
    choices: Array<{
      message: { content: string };
    }>;
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  const elapsedMs = Math.round(performance.now() - start);

  return {
    text,
    providerId: provider.id,
    providerName: provider.name,
    model: provider.model,
    elapsedMs,
  };
}

/**
 * Auto-fallback router: tries each enabled provider in priority order.
 */
export async function sendChatWithFallback(
  providers: ProviderConfig[],
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ProviderResponse> {
  const enabled = getEnabledProviders(providers);
  if (enabled.length === 0) {
    throw {
      providerId: 'none',
      providerName: 'none',
      message: 'No providers configured. Add an API key in Provider Settings.',
    } as ProviderError;
  }

  let lastError: ProviderError | null = null;
  for (const provider of enabled) {
    try {
      return await callProvider(provider, messages, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      if (err instanceof Error) {
        lastError = {
          providerId: provider.id,
          providerName: provider.name,
          message: err.message,
        };
      } else {
        lastError = err as ProviderError;
      }
      // Try next provider
    }
  }
  throw lastError ?? { providerId: 'none', providerName: 'none', message: 'All providers failed' };
}
