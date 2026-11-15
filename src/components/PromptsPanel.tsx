// ============================================================================
// PromptsPanel — Prompt library management (Phase 7)
// ============================================================================

import { useState } from 'react';
import { Plus, Trash2, Search, Copy } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { PromptSnippet } from '@/types';

interface PromptsPanelProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  prompts: PromptSnippet[];
  onAdd: (prompt: PromptSnippet) => void;
  onRemove: (id: string) => void;
  onUse: (body: string) => void;
}

export function PromptsPanel({ t, dir, prompts, onAdd, onRemove, onUse }: PromptsPanelProps) {
  const [search, setSearch] = useState('');

  const filtered = prompts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.body.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = () => {
    onAdd({
      id: `custom-${Date.now()}`,
      title: 'New Prompt',
      body: 'Write your prompt here…',
      category: 'Custom',
    });
  };

  return (
    <div dir={dir} className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.promptLibrary}</h2>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addPrompt}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary-400 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500 col-span-2 text-center py-8">{t.noPrompts}</p>
        ) : (
          filtered.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-md bg-accent-50 dark:bg-accent-950/30 text-accent-700 dark:text-accent-400 px-1.5 py-0.5 text-xs font-medium">
                      {prompt.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mt-1">{prompt.title}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-3">{prompt.body}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUse(prompt.body)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 px-2 py-1 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Use
                </button>
                <button
                  onClick={() => onRemove(prompt.id)}
                  className="inline-flex items-center gap-1 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/30 px-2 py-1 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
