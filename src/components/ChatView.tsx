// ============================================================================
// ChatView — Renders chat turns with RAG badges and provider info
// ============================================================================

import { User, Bot, Loader as Loader2, CircleAlert as AlertCircle, Database } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { ChatTurn } from '@/hooks/useChat';

interface ChatViewProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  turns: ChatTurn[];
  personaName: string;
}

export function ChatView({ t, dir, turns, personaName }: ChatViewProps) {
  if (turns.length === 0) {
    return (
      <div dir={dir} className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center">
          <Bot className="w-8 h-8 text-primary-500" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">{personaName}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.typeMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div dir={dir} className="flex-1 overflow-y-auto p-4 space-y-4">
      {turns.map((turn) => {
        const isUser = turn.role === 'user';
        return (
          <div key={turn.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`
              flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${isUser
                ? 'bg-neutral-200 dark:bg-neutral-700'
                : 'bg-primary-500'
              }
            `}>
              {isUser ? (
                <User className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {/* RAG badge */}
              {!isUser && turn.ragUsed && !turn.error && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 text-xs font-medium">
                  <Database className="w-3 h-3" />
                  {t.ragUsedBadge}
                </span>
              )}
              <div className={`
                rounded-2xl px-4 py-2.5 text-sm
                ${isUser
                  ? 'bg-primary-500 text-white rounded-tr-sm'
                  : turn.error
                    ? 'bg-error-50 dark:bg-error-950/30 text-error-700 dark:text-error-300 rounded-tl-sm border border-error-200 dark:border-error-800'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-tl-sm'
                }
              `}>
                {turn.pending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-neutral-500">{t.thinking}</span>
                  </div>
                ) : turn.error ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{turn.error}</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {turn.content}
                  </div>
                )}
              </div>
              {/* Provider info */}
              {!isUser && turn.providerName && !turn.pending && !turn.error && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 px-1">
                  {turn.providerName} · {turn.elapsedMs}ms
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
