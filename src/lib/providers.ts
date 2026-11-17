// ============================================================================
// providers — Multi-provider registry + LiveModelSyncEngine (Phase 10A)
// 24/7 model discovery, deprecated-model pruning, direct API key portal links
// ============================================================================

import type { ProviderConfig } from '@/types';
import {
  getSyncMeta,
  setSyncMeta,
  getModelCache,
  putModelCache,
  getDeadModels,
  addLog,
} from '@/lib/apiKeyStore';

// ---------------------------------------------------------------------------
// Provider catalog — built-in definitions with portal links & 2026 models
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
  /** Live /models discovery supported? */
  liveDiscovery: boolean;
}

export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    id: 'openai-default',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6.1-sol',
    models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-4.1', 'gpt-4o-mini', 'o4-mini', 'gpt-oss-120b'],
    signupUrl: 'https://platform.openai.com/api-keys',
    flavor: 'openai',
    freeTier: false,
    liveDiscovery: true,
  },
  {
    id: 'anthropic-default',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5-5',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-2', 'claude-sonnet-4-6'],
    signupUrl: 'https://platform.claude.com/settings/keys',
    flavor: 'openai',
    freeTier: false,
    liveDiscovery: true,
  },
  {
    id: 'gemini-default',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.8-flash',
    models: ['gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-4-carbon', 'gemini-3.5-flash-lite', 'gemma-4'],
    signupUrl: 'https://aistudio.google.com/api-keys',
    flavor: 'gemini',
    freeTier: true,
    liveDiscovery: true,
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
    liveDiscovery: true,
  },
  {
    id: 'openrouter-default',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
    models: ['openrouter/free', 'deepseek/deepseek-chat-v3-0324:free', 'anthropic/claude-3.5-sonnet:free'],
    signupUrl: 'https://openrouter.ai/settings/keys',
    flavor: 'openai',
    freeTier: true,
    liveDiscovery: true,
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
    liveDiscovery: true,
  },
  {
    id: 'cerebras-default',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
    signupUrl: 'https://cloud.cerebras.ai/',
    flavor: 'openai',
    freeTier: true,
    liveDiscovery: true,
  },
  {
    id: 'github-models-default',
    name: 'GitHub Models',
    baseUrl: 'https://models.inference.ai.azure.com',
    model: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'Phi-3.5-MoE-instruct', 'Meta-Llama-3.3-70B-Instruct'],
    signupUrl: 'https://github.com/settings/tokens',
    flavor: 'openai',
    freeTier: false,
    liveDiscovery: false,
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
    liveDiscovery: true,
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
    liveDiscovery: false,
  },
  {
    id: 'nvidia-nim-default',
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct',
    models: ['meta/llama-3.3-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    signupUrl: 'https://build.nvidia.com/',
    flavor: 'openai',
    freeTier: true,
    liveDiscovery: false,
  },
  {
    id: 'cloudflare-default',
    name: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    models: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen2.5-coder-32b-instruct'],
    signupUrl: 'https://dash.cloudflare.com/',
    flavor: 'openai',
    freeTier: true,
    liveDiscovery: false,
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
    liveDiscovery: true,
  },
];

const STORAGE_KEY = 'omnifree-providers';

function fromDefinition(d: ProviderDefinition): ProviderConfig {
  return {
    id: d.id,
    name: d.name,
    apiKey: '',
    baseUrl: d.baseUrl,
    model: d.model,
    enabled: false,
    priority: d.freeTier ? 1 : 5,
  };
}

export function loadProviders(): ProviderConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ProviderConfig[];
      const known = new Set(parsed.map((p) => p.id));
      const missing = PROVIDER_CATALOG.filter((d) => !known.has(d.id)).map(fromDefinition);
      return [...parsed, ...missing];
    }
    return PROVIDER_CATALOG.map(fromDefinition);
  } catch {
    return PROVIDER_CATALOG.map(fromDefinition);
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

/**
 * Effective model list for a provider: cached live catalog minus dead models,
 * falling back to the built-in catalog. Used by the router to pick replacements.
 */
export async function getEffectiveModels(provider: ProviderConfig): Promise<string[]> {
  const [cached, dead] = await Promise.all([
    getModelCache(provider.id),
    getDeadModels(),
  ]);
  const deadForProvider = new Set(dead.filter((d) => d.providerId === provider.id).map((d) => d.model));
  const definition = getDefinition(provider.id);
  const base = cached?.models ?? definition?.models ?? [provider.model];
  const live = base.filter((m) => !deadForProvider.has(m));
  const list = live.length > 0 ? live : definition?.models.filter((m) => !deadForProvider.has(m)) ?? [];
  return list.length > 0 ? list : [provider.model];
}

// ---------------------------------------------------------------------------
// Last-used provider persistence (rotation seed)
// ---------------------------------------------------------------------------

const LAST_PROVIDER_KEY = 'omnifree-last-provider';

export function getLastUsedProviderId(): string {
  return localStorage.getItem(LAST_PROVIDER_KEY) ?? '';
}

export function setLastUsedProviderId(id: string): void {
  localStorage.setItem(LAST_PROVIDER_KEY, id);
}

// ---------------------------------------------------------------------------
// LiveModelSyncEngine — 24/7 autonomous model discovery & pruning
// ---------------------------------------------------------------------------

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // check every 6h
const SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000; // sync when >24h stale

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}

interface GeminiModelsResponse {
  models?: Array<{ name?: string }>;
}

function extractModelIds(provider: ProviderConfig, payload: unknown): string[] {
  // Gemini nests under `models` with `name: "models/gemini-3.8-flash"`
  if (provider.id.startsWith('gemini')) {
    const gemini = payload as GeminiModelsResponse;
    return (gemini.models ?? [])
      .map((m) => m.name?.replace(/^models\//, '') ?? '')
      .filter((id) => id.length > 0);
  }
  // OpenAI-compatible shape: { data: [{ id }] }
  const openai = payload as OpenAIModelsResponse;
  return (openai.data ?? [])
    .map((m) => m.id ?? '')
    .filter((id) => id.length > 0);
}

/**
 * Fetch the live /models list for one provider, prune retired models,
 * promote the newest model as default if the current default vanished.
 * Returns the fresh model list (or null when discovery is unavailable).
 */
export async function syncProviderModels(provider: ProviderConfig): Promise<string[] | null> {
  const definition = getDefinition(provider.id);
  if (!definition?.liveDiscovery || !provider.apiKey.trim()) return null;

  let url: string;
  const headers: Record<string, string> = {};
  if (provider.id.startsWith('gemini')) {
    url = `${provider.baseUrl}/models`;
    headers['x-goog-api-key'] = provider.apiKey;
  } else if (provider.id.startsWith('openrouter')) {
    url = 'https://openrouter.ai/api/v1/models'; // public, unauthenticated
  } else {
    url = `${provider.baseUrl}/models`;
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    const liveIds = extractModelIds(provider, payload);
    if (liveIds.length === 0) return null;

    // For OpenRouter keep only free-tier models in the cached catalog
    const filtered = provider.id.startsWith('openrouter')
      ? liveIds.filter((id) => id.endsWith(':free') || id === 'openrouter/free')
      : liveIds;
    const final = filtered.length > 0 ? filtered : liveIds;

    // Prune: drop cached models no longer returned upstream
    const cached = await getModelCache(provider.id);
    if (cached) {
      const liveSet = new Set(final);
      const pruned = cached.models.filter((m) => !liveSet.has(m));
      for (const retired of pruned) {
        await addLog('prune', `${provider.name}: pruned retired model "${retired}"`);
      }
    }

    await putModelCache(provider.id, final);

    // Auto-promote: if the configured default was retired, adopt the newest live model
    if (!final.includes(provider.model)) {
      const all = loadProviders();
      saveProviders(all.map((p) => (p.id === provider.id ? { ...p, model: final[0] } : p)));
      await addLog('repair', `${provider.name}: default model "${provider.model}" retired — promoted "${final[0]}"`);
    }

    return final;
  } catch {
    return null; // offline or blocked — cache remains, non-fatal
  }
}

export interface SyncResult {
  syncedProviders: number;
  discoveredModels: number;
}

/** Sync every configured provider and persist the lastSyncedAt timestamp. */
export async function syncAllProviders(providers: ProviderConfig[]): Promise<SyncResult> {
  let syncedProviders = 0;
  let discoveredModels = 0;
  for (const provider of providers) {
    const models = await syncProviderModels(provider);
    if (models) {
      syncedProviders++;
      discoveredModels += models.length;
    }
  }
  await setSyncMeta(Date.now());
  await addLog('sync', `Model discovery: ${syncedProviders} provider(s), ${discoveredModels} live model(s)`);
  return { syncedProviders, discoveredModels };
}

let syncEngineStarted = false;

/**
 * Boot the LiveModelSyncEngine once: syncs if stale (>24h), then checks every
 * 6h while online, and re-syncs when internet connectivity returns.
 */
export function startLiveModelSyncEngine(getProviders: () => ProviderConfig[]): void {
  if (syncEngineStarted || typeof window === 'undefined') return;
  syncEngineStarted = true;

  const maybeSync = async (): Promise<void> => {
    if (!navigator.onLine) return;
    const meta = await getSyncMeta();
    if (Date.now() - meta.lastSyncedAt < SYNC_THRESHOLD_MS) return;
    await syncAllProviders(getProviders()).catch(() => undefined);
  };

  void maybeSync();
  window.setInterval(() => void maybeSync(), SYNC_INTERVAL_MS);
  window.addEventListener('online', () => void maybeSync());
}

/** Test an API key by hitting the provider's cheapest authenticated endpoint. */
export async function testProviderKey(provider: ProviderConfig): Promise<boolean> {
  const definition = getDefinition(provider.id);
  if (!provider.apiKey.trim()) return false;
  try {
    if (definition?.flavor === 'gemini') {
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: { 'x-goog-api-key': provider.apiKey },
      });
      return response.ok;
    }
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
