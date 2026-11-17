// ============================================================================
// router — Self-healing router & circuit breaker (Phase 10A)
// Monitors every request: 404 → mark model dead + refresh + retry next model;
// 429/402/403/5xx/network → timed cooldown + failover to next healthy provider
// ============================================================================

import type { ChatMessage, ProviderResponse, ProviderError, ProviderConfig } from '@/types';
import {
  getDefinition,
  loadProviders,
  saveProviders,
  getEnabledProviders,
  getEffectiveModels,
  getLastUsedProviderId,
  setLastUsedProviderId,
  syncProviderModels,
} from '@/lib/providers';
import {
  markModelDead,
  isModelDead,
  setCooldown,
  getCooldown,
  addLog,
} from '@/lib/apiKeyStore';

// ---------------------------------------------------------------------------
// Raw transport — OpenAI-compatible + Gemini native callers
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
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  if (provider.id.startsWith('openrouter')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'OmniFree AI Studio';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: toOpenAIMessages(messages),
      max_tokens: 2048,
      temperature: 0.7,
    }),
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

// ---------------------------------------------------------------------------
// Circuit breaker helpers
// ---------------------------------------------------------------------------

export interface RotationEvent {
  failedProviderId: string;
  failedProviderName: string;
  reason: string;
  nextProviderName: string;
}

export interface SendOptions {
  signal: AbortSignal;
  manualProviderId?: string;
  onRotation?: (event: RotationEvent) => void;
}

function cooldownMsForStatus(status: number | undefined): number {
  if (status === 429) return 60_000; // rate limited — retry in a minute
  if (status === 402 || status === 403) return 10 * 60_000; // quota exhausted
  if (status !== undefined && status >= 500) return 30_000;
  return 15_000; // network error / timeout
}

function isCooldownWorthy(status: number | undefined): boolean {
  if (status === undefined) return true; // network error / timeout
  return status === 429 || status === 402 || status === 403 || status >= 500;
}

async function pickReplacementModel(provider: ProviderConfig): Promise<string | null> {
  const candidates = await getEffectiveModels(provider);
  for (const model of candidates) {
    if (model !== provider.model && !(await isModelDead(provider.id, model))) {
      return model;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SelfHealingRouter — send with 404 model repair + cooldown failover
// ---------------------------------------------------------------------------

export async function sendChatWithFallback(
  providers: ProviderConfig[],
  messages: ChatMessage[],
  signal: AbortSignal,
  options?: { manualProviderId?: string; onRotation?: (event: RotationEvent) => void },
): Promise<ProviderResponse> {
  const manualId = options?.manualProviderId;
  const onRotation = options?.onRotation;

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

  // Filter out providers currently in cooldown (unless all are cooling down)
  const cooldownChecks = await Promise.all(
    enabled.map(async (p) => ({ p, cd: await getCooldown(p.id) })),
  );
  const healthy = cooldownChecks.filter((c) => c.cd === undefined).map((c) => c.p);
  const queue = healthy.length > 0 ? healthy : enabled;

  const lastId = getLastUsedProviderId();
  const ordered = [...queue].sort((a, b) => {
    if (a.id === lastId) return -1;
    if (b.id === lastId) return 1;
    return a.priority - b.priority;
  });

  let lastError: ProviderError | null = null;

  for (let i = 0; i < ordered.length; i++) {
    const provider = ordered[i];

    // Skip providers whose current model is already known dead — swap first
    if (await isModelDead(provider.id, provider.model)) {
      const replacement = await pickReplacementModel(provider);
      if (replacement) {
        provider = { ...provider, model: replacement };
      } else {
        lastError = {
          providerId: provider.id,
          providerName: provider.name,
          message: 'All known models are retired',
        };
        continue;
      }
    }

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

      // HTTP 404 — model retired: mark dead, purge, refresh catalog, retry
      if (providerError.status === 404) {
        await markModelDead(provider.id, provider.model, providerError.message);
        await addLog('repair', `${provider.name}: model "${provider.model}" retired (404) — marked dead, syncing fresh catalog`);
        const replacement = await pickReplacementModel(provider);
        if (replacement) {
          const all = loadProviders();
          saveProviders(all.map((p) => (p.id === provider.id ? { ...p, model: replacement } : p)));
          void syncProviderModels(provider).catch(() => undefined);
          try {
            const retried = await callProvider({ ...provider, model: replacement }, messages, signal);
            setLastUsedProviderId(provider.id);
            return retried;
          } catch (retryErr) {
            if (signal.aborted) throw retryErr;
            providerError = retryErr instanceof Error
              ? { ...providerError, message: retryErr.message }
              : (retryErr as ProviderError);
            lastError = providerError;
          }
        }
        continue;
      }

      // Rate limit / quota / 5xx / network — timed cooldown + failover
      if (isCooldownWorthy(providerError.status)) {
        const ms = cooldownMsForStatus(providerError.status);
        await setCooldown(provider.id, Date.now() + ms, providerError.message);
        await addLog(
          'cooldown',
          `${provider.name}: ${providerError.status ? `HTTP ${providerError.status}` : 'network error'} — cooldown ${Math.round(ms / 1000)}s`,
        );
      }

      const next = ordered[i + 1];
      if (next && onRotation) {
        onRotation({
          failedProviderId: provider.id,
          failedProviderName: provider.name,
          reason: providerError.status
            ? `HTTP ${providerError.status}`
            : 'network error',
          nextProviderName: next.name,
        });
      }
    }
  }

  throw lastError ?? ({ providerId: 'none', providerName: 'none', message: 'All providers failed' } as ProviderError);
}
