// ============================================================================
// ProvidersPanel — Provider cards with one-click key portal links, live key
// testing, model sync status bar and OpenRouter category tabs (Phase 10A)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Zap, ZapOff, ExternalLink, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { ProviderConfig } from '@/types';
import { getDefinition, syncProviderModels, syncAllProviders, startLiveModelSyncEngine } from '@/lib/providers';
import { getSyncMeta, getRecentLogs, type RouterLogEntry } from '@/lib/apiKeyStore';

interface ProvidersPanelProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  providers: ProviderConfig[];
  onUpdate: (id: string, updates: Partial<ProviderConfig>) => void;
  onAdd: (provider: ProviderConfig) => void;
  onRemove: (id: string) => void;
}

type TestState = 'idle' | 'testing' | 'valid' | 'invalid';

type OpenRouterTab = 'all' | 'claude' | 'chatgpt' | 'gemini' | 'deepseek';

function matchesTab(model: string, tab: OpenRouterTab): boolean {
  const lower = model.toLowerCase();
  switch (tab) {
    case 'claude': return lower.includes('claude');
    case 'chatgpt': return lower.includes('gpt') || lower.includes('o4-mini');
    case 'gemini': return lower.includes('gemini') || lower.includes('gemma');
    case 'deepseek': return lower.includes('deepseek');
    default: return true;
  }
}

export function ProvidersPanel({ t, dir, providers, onUpdate, onAdd, onRemove }: ProvidersPanelProps) {
  const enabledCount = providers.filter((p) => p.enabled && p.apiKey.trim()).length;
  const sorted = [...providers].sort((a, b) => a.priority - b.priority);

  // Per-provider key test state
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});

  // Live sync status bar
  const [lastSyncedAt, setLastSyncedAt] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logEntries, setLogEntries] = useState<RouterLogEntry[]>([]);

  // OpenRouter category tabs
  const [orTab, setOrTab] = useState<OpenRouterTab>('all');

  // OmniRoute Gateway card state
  const omniRoute = providers.find((p) => p.id === 'omniroute-default');
  const [omniRouteState, setOmniRouteState] = useState<'idle' | 'syncing' | 'connected' | 'offline'>('idle');
  const [omniRouteModels, setOmniRouteModels] = useState<string[]>([]);

  const handleOmniRouteSync = useCallback(async () => {
    if (!omniRoute) return;
    setOmniRouteState('syncing');
    const models = await syncProviderModels(omniRoute);
    if (models) {
      setOmniRouteModels(models);
      setOmniRouteState('connected');
      onUpdate(omniRoute.id, { enabled: true });
    } else {
      setOmniRouteState('offline');
    }
    await refreshSyncStatus();
  }, [omniRoute, onUpdate, refreshSyncStatus]);

  const refreshSyncStatus = useCallback(async () => {
    const [meta, logs] = await Promise.all([getSyncMeta(), getRecentLogs(5)]);
    setLastSyncedAt(meta.lastSyncedAt);
    setLogEntries(logs);
  }, []);

  useEffect(() => {
    void refreshSyncStatus();
    startLiveModelSyncEngine(() => providers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncAllProviders(providers);
      await refreshSyncStatus();
    } finally {
      setIsSyncing(false);
    }
  }, [providers, refreshSyncStatus]);

  const handleTestKey = useCallback(async (provider: ProviderConfig) => {
    setTestStates((prev) => ({ ...prev, [provider.id]: 'testing' }));
    const { testProviderKey } = await import('@/lib/providers');
    const ok = await testProviderKey(provider);
    setTestStates((prev) => ({ ...prev, [provider.id]: ok ? 'valid' : 'invalid' }));
    onUpdate(provider.id, { enabled: ok });
  }, [onUpdate]);

  const handleAdd = () => {
    const newProvider: ProviderConfig = {
      id: `custom-${Date.now()}`,
      name: 'Custom Provider',
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      model: 'model-name',
      enabled: false,
      priority: providers.length + 1,
    };
    onAdd(newProvider);
  };

  const openRouter = providers.find((p) => p.id === 'openrouter-default');
  const openRouterDefinition = openRouter ? getDefinition(openRouter.id) : undefined;
  const orModels = openRouterDefinition?.models ?? [];

  const renderTestBadge = (provider: ProviderConfig) => {
    const state = testStates[provider.id] ?? 'idle';
    if (state === 'idle') return null;
    if (state === 'testing') {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" />;
    }
    return state === 'valid' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 text-xs font-medium">
        <CheckCircle2 className="w-3 h-3" /> {t.keyValid}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-50 dark:bg-error-950/30 text-error-700 dark:text-error-400 px-2 py-0.5 text-xs font-medium">
        <XCircle className="w-3 h-3" /> {t.keyInvalid}
      </span>
    );
  };

  return (
    <div dir={dir} className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.providers}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSyncNow()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 px-3 py-1.5 text-sm font-medium hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {t.syncModelsNow}
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.addProvider}
          </button>
        </div>
      </div>

      {/* Live sync status bar */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-neutral-600 dark:text-neutral-300">
            {t.lastSync}: {lastSyncedAt > 0 ? new Date(lastSyncedAt).toLocaleString() : t.neverSynced}
          </span>
          <span className="inline-flex items-center gap-1 text-success-700 dark:text-success-400 font-medium">
            <Zap className="w-3 h-3" />
            {enabledCount} {t.healthyProviders}
          </span>
        </div>
        {logEntries.length > 0 && (
          <ul className="space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {logEntries.map((entry) => (
              <li key={entry.id} className="truncate">
                <span className="font-medium">{entry.kind}:</span> {entry.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* OmniRoute Gateway — prominent local gateway card */}
      {omniRoute && (
        <div className="rounded-xl border-2 border-primary-300 dark:border-primary-700 bg-primary-50/60 dark:bg-primary-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-primary-700 dark:text-primary-300">{omniRoute.name}</span>
              {omniRouteState === 'connected' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-500 text-white px-2 py-0.5 text-xs font-medium flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> Connected ✓
                </span>
              )}
              {omniRouteState === 'offline' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-error-500 text-white px-2 py-0.5 text-xs font-medium flex-shrink-0">
                  <XCircle className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
            <button
              onClick={() => onUpdate(omniRoute.id, { enabled: !omniRoute.enabled })}
              className={`
                relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0
                ${omniRoute.enabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}
              `}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${omniRoute.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={omniRoute.baseUrl}
              onChange={(e) => onUpdate(omniRoute.id, { baseUrl: e.target.value })}
              placeholder="http://localhost:20128/v1"
              className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary-400 transition-colors"
            />
            <button
              onClick={() => onUpdate(omniRoute.id, { baseUrl: 'http://localhost:20128/v1' })}
              className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors flex-shrink-0 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/60"
            >
              Local (:20128)
            </button>
            <button
              onClick={() => onUpdate(omniRoute.id, { baseUrl: 'https://' })}
              className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors flex-shrink-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              Custom URL
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              value={omniRoute.apiKey === 'local' ? '' : omniRoute.apiKey}
              onChange={(e) => onUpdate(omniRoute.id, { apiKey: e.target.value })}
              placeholder="API key (optional)"
              className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
            />
            <button
              onClick={() => void handleOmniRouteSync()}
              disabled={omniRouteState === 'syncing'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {omniRouteState === 'syncing'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Sync & Connect
            </button>
          </div>

          {omniRouteModels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {omniRouteModels.map((model) => (
                <button
                  key={model}
                  onClick={() => onUpdate(omniRoute.id, { model })}
                  className={`rounded-lg px-2 py-1 text-xs font-mono transition-colors ${
                    omniRoute.model === model
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-primary-400'
                  }`}
                >
                  {model}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {enabledCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 px-3 py-2">
          <Zap className="w-4 h-4 text-success-600 dark:text-success-400" />
          <span className="text-sm text-success-700 dark:text-success-400">
            {enabledCount} provider{enabledCount > 1 ? 's' : ''} active · Auto-rotation enabled
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 px-3 py-2">
          <ZapOff className="w-4 h-4 text-warning-600 dark:text-warning-400" />
          <span className="text-sm text-warning-700 dark:text-warning-400">{t.noProvidersDesc}</span>
        </div>
      )}

      {/* OpenRouter unified gateway tabs */}
      {openRouterDefinition && openRouter?.apiKey.trim() && (
        <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20 p-3 space-y-2">
          <p className="text-sm font-semibold text-primary-700 dark:text-primary-400">
            {t.openRouterGateway} — {t.oneKeyAllModels}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'claude', 'chatgpt', 'gemini', 'deepseek'] as OpenRouterTab[]).map((tab) => {
              const count = orModels.filter((m) => matchesTab(m, tab)).length;
              return (
                <button
                  key={tab}
                  onClick={() => setOrTab(tab)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    orTab === tab
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {t[`or_${tab}` as const]} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {orModels
              .filter((m) => matchesTab(m, orTab))
              .map((model) => (
                <button
                  key={model}
                  onClick={() => openRouter && onUpdate(openRouter.id, { model })}
                  className={`rounded-lg px-2 py-1 text-xs font-mono transition-colors ${
                    openRouter?.model === model
                      ? 'bg-primary-500 text-white'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hover:border-primary-400'
                  }`}
                >
                  {model}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((provider) => {
          const definition = getDefinition(provider.id);
          return (
            <div key={provider.id} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 truncate">{provider.name}</span>
                  {provider.enabled && provider.apiKey.trim() && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 text-xs font-medium flex-shrink-0">
                      <Zap className="w-3 h-3" />
                      Priority {provider.priority}
                    </span>
                  )}
                  {definition?.freeTier && (
                    <span className="rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 text-[10px] uppercase font-semibold flex-shrink-0">
                      free tier
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onUpdate(provider.id, { enabled: !provider.enabled })}
                    className={`
                      relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                      ${provider.enabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}
                    `}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${provider.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                  <button
                    onClick={() => onRemove(provider.id)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder={t.apiKey}
                    value={provider.apiKey}
                    onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
                    className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
                  />
                  {definition && (
                    <a
                      href={definition.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t.getKey}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 px-2.5 py-1.5 text-xs font-medium hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t.getKey}
                    </a>
                  )}
                  <button
                    onClick={() => void handleTestKey(provider)}
                    disabled={!provider.apiKey.trim() || testStates[provider.id] === 'testing'}
                    className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 px-2.5 py-1.5 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    {t.testSaveKey}
                  </button>
                  {renderTestBadge(provider)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={t.baseUrl}
                    value={provider.baseUrl}
                    onChange={(e) => onUpdate(provider.id, { baseUrl: e.target.value })}
                    className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
                  />
                  {definition ? (
                    <select
                      value={definition.models.includes(provider.model) ? provider.model : definition.models[0]}
                      onChange={(e) => onUpdate(provider.id, { model: e.target.value })}
                      className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
                    >
                      {definition.models.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={t.model}
                      value={provider.model}
                      onChange={(e) => onUpdate(provider.id, { model: e.target.value })}
                      className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
                    />
                  )}
                </div>
                <input
                  type="number"
                  placeholder={t.priority}
                  value={provider.priority}
                  onChange={(e) => onUpdate(provider.id, { priority: parseInt(e.target.value, 10) || 1 })}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors w-24"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
