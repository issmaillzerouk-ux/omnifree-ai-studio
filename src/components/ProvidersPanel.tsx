// ============================================================================
// ProvidersPanel — Provider configuration with auto-fallback routing
// ============================================================================

import { Plus, Trash2, Zap, ZapOff } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { ProviderConfig } from '@/types';

interface ProvidersPanelProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  providers: ProviderConfig[];
  onUpdate: (id: string, updates: Partial<ProviderConfig>) => void;
  onAdd: (provider: ProviderConfig) => void;
  onRemove: (id: string) => void;
}

export function ProvidersPanel({ t, dir, providers, onUpdate, onAdd, onRemove }: ProvidersPanelProps) {
  const enabledCount = providers.filter((p) => p.enabled && p.apiKey.trim()).length;
  const sorted = [...providers].sort((a, b) => a.priority - b.priority);

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

  return (
    <div dir={dir} className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.providers}</h2>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addProvider}
        </button>
      </div>

      {enabledCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800 px-3 py-2">
          <Zap className="w-4 h-4 text-success-600 dark:text-success-400" />
          <span className="text-sm text-success-700 dark:text-success-400">
            {enabledCount} provider{enabledCount > 1 ? 's' : ''} active · Auto-fallback enabled
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-warning-50 dark:bg-warning-950/30 border border-warning-200 dark:border-warning-800 px-3 py-2">
          <ZapOff className="w-4 h-4 text-warning-600 dark:text-warning-400" />
          <span className="text-sm text-warning-700 dark:text-warning-400">{t.noProvidersDesc}</span>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((provider) => (
          <div key={provider.id} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{provider.name}</span>
                {provider.enabled && provider.apiKey.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 text-xs font-medium">
                    <Zap className="w-3 h-3" />
                    Priority {provider.priority}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
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
              <input
                type="password"
                placeholder={t.apiKey}
                value={provider.apiKey}
                onChange={(e) => onUpdate(provider.id, { apiKey: e.target.value })}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t.baseUrl}
                  value={provider.baseUrl}
                  onChange={(e) => onUpdate(provider.id, { baseUrl: e.target.value })}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
                />
                <input
                  type="text"
                  placeholder={t.model}
                  value={provider.model}
                  onChange={(e) => onUpdate(provider.id, { model: e.target.value })}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:border-primary-400 transition-colors"
                />
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
        ))}
      </div>
    </div>
  );
}
