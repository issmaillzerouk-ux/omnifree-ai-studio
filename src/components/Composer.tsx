// ============================================================================
// Composer — Chat input with RAG status indicator (Phase 8)
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { Send, Square, Sparkles, Database, Trash2 } from 'lucide-react';
import type { Translation } from '@/lib/i18n';

interface ComposerProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
  isLoading: boolean;
  ragActive: boolean;
  ragSnippetCount: number;
}

export function Composer({ t, dir, onSend, onStop, onClear, isLoading, ragActive, ragSnippetCount }: ComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (!text.trim() || isLoading) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isLoading, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  return (
    <div dir={dir} className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3">
      {/* RAG status bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2 text-xs">
          {ragActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 font-medium">
              <Database className="w-3 h-3" />
              {t.ragActive}
              {ragSnippetCount > 0 && ` · ${ragSnippetCount}`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 font-medium">
              <Database className="w-3 h-3" />
              {t.ragInactive}
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-xs text-neutral-400 hover:text-error-600 dark:hover:text-error-400 transition-colors inline-flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          {t.clearChat}
        </button>
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t.typeMessage}
            rows={1}
            disabled={isLoading}
            className="
              w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-700
              bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100
              placeholder-neutral-400 dark:placeholder-neutral-500
              px-4 py-2.5 text-sm
              focus:outline-none focus:border-primary-400 dark:focus:border-primary-500
              focus:ring-1 focus:ring-primary-400 dark:focus:ring-primary-500
              transition-all
              disabled:opacity-60
              max-h-40
            "
          />
        </div>
        {isLoading ? (
          <button
            onClick={onStop}
            className="
              flex items-center justify-center gap-1.5
              rounded-xl bg-error-500 hover:bg-error-600 text-white
              px-4 py-2.5 text-sm font-medium
              transition-colors flex-shrink-0
            "
          >
            <Square className="w-4 h-4" />
            {t.stop}
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="
              flex items-center justify-center gap-1.5
              rounded-xl bg-primary-500 hover:bg-primary-600 text-white
              px-4 py-2.5 text-sm font-medium
              transition-all flex-shrink-0
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-95
            "
          >
            <Send className="w-4 h-4" />
            {t.sendMessage}
          </button>
        )}
      </div>
    </div>
  );
}
