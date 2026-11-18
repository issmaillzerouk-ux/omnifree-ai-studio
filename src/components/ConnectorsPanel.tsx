// ============================================================================
// ConnectorsPanel — Connected Apps & Tools Hub grid (Phase 10B)
// ============================================================================

import { useState } from 'react';
import { ExternalLink, Link2, Check, Loader2, Puzzle, Image as ImageIcon, Globe, GraduationCap, Volume2, Search, SearchCheck, Camera, Workflow, Github, FileText, Wrench } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import {
  CONNECTOR_CATALOG,
  isConnectorConnected,
  getConnectorKey,
  type ConnectorId,
} from '@/lib/connectors';

export interface ConnectorState {
  connected: Partial<Record<ConnectorId, boolean>>;
  keys: Partial<Record<ConnectorId, string>>;
}

interface ConnectorsPanelProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  state: ConnectorState;
  onToggle: (id: ConnectorId, connected: boolean) => void;
  onSaveKey: (id: ConnectorId, key: string) => void;
}

const CONNECTOR_ICONS: Record<ConnectorId, typeof Globe> = {
  pollinations: ImageIcon,
  jina: Globe,
  openscience: GraduationCap,
  tts: Volume2,
  photofinder: Camera,
  searchgpt: SearchCheck,
  tavily: Search,
  huggingface: Puzzle,
  automation: Workflow,
  github: Github,
  notion: FileText,
  custom: Wrench,
};

export function ConnectorsPanel({ t, dir, state, onToggle, onSaveKey }: ConnectorsPanelProps) {
  const [draftKeys, setDraftKeys] = useState<Partial<Record<ConnectorId, string>>>({});

  return (
    <div dir={dir} className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.connectedApps}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{t.connectedAppsDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CONNECTOR_CATALOG.map((connector) => {
          const Icon = CONNECTOR_ICONS[connector.id];
          const isConnected = isConnectorConnected(state, connector.id);
          const savedKey = getConnectorKey(state, connector.id);
          const draft = draftKeys[connector.id] ?? '';

          return (
            <div
              key={connector.id}
              className={`rounded-xl border p-4 flex flex-col gap-2.5 transition-colors ${
                isConnected
                  ? 'border-success-300 dark:border-success-800 bg-success-50/40 dark:bg-success-950/10'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isConnected
                      ? 'bg-success-100 dark:bg-success-900/40 text-success-600 dark:text-success-400'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                  }`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">{connector.name}</p>
                    <span className={`text-[10px] uppercase font-bold tracking-wide ${
                      connector.zeroKey
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-warning-600 dark:text-warning-400'
                    }`}>
                      {connector.zeroKey ? t.zeroKey : t.portalKey}
                    </span>
                  </div>
                </div>
                {isConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-500 text-white px-2 py-0.5 text-xs font-medium flex-shrink-0">
                    <Check className="w-3 h-3" />
                    {t.connected}
                  </span>
                )}
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{connector.description}</p>

              <div className="flex items-center gap-2 mt-auto flex-wrap">
                {connector.zeroKey ? (
                  <button
                    onClick={() => onToggle(connector.id, !isConnected)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isConnected
                        ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                        : 'bg-success-500 hover:bg-success-600 text-white'
                    }`}
                  >
                    {isConnected ? t.disconnect : t.connect}
                  </button>
                ) : (
                  <>
                    <input
                      type="password"
                      value={connector.id === 'automation' || connector.id === 'custom' ? draft || savedKey : draft}
                      onChange={(e) => setDraftKeys((prev) => ({ ...prev, [connector.id]: e.target.value }))}
                      placeholder={savedKey ? '••••••••' : connector.keyPlaceholder ?? t.connectorKeyPlaceholder}
                      className="flex-1 min-w-[140px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary-400 transition-colors"
                    />
                    <button
                      onClick={() => {
                        const value = draft.trim();
                        if (value.length === 0) return;
                        onSaveKey(connector.id, value);
                        onToggle(connector.id, true);
                        setDraftKeys((prev) => ({ ...prev, [connector.id]: '' }));
                      }}
                      disabled={draft.trim().length === 0}
                      className="rounded-lg bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      {t.saveKey}
                    </button>
                    {savedKey && (
                      <button
                        onClick={() => onToggle(connector.id, !isConnected)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0 ${
                          isConnected
                            ? 'bg-success-500 text-white hover:bg-success-600'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {isConnected ? t.connected : t.connect}
                      </button>
                    )}
                  </>
                )}

                {connector.portalUrl && (
                  <a
                    href={connector.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 px-2.5 py-1.5 text-xs font-medium hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {t.getKey}
                  </a>
                )}

                {connector.id === 'automation' && <Link2 className="w-3 h-3 text-neutral-400" />}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
        <Loader2 className="w-3 h-3" />
        {t.automationSent} / {t.automationFailed} — {t.webContextJina} · {t.webContextKnowledge}
      </p>
    </div>
  );
}
