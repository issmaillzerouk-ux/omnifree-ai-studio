// ============================================================================
// ChatView — Chat turns with RAG/web-context badges, media lightbox,
// motion storyboards and response action buttons (Phases 8-10B)
// ============================================================================

import { useState } from 'react';
import {
  User, Bot, Loader as Loader2, CircleAlert as AlertCircle, Database,
  Globe, GraduationCap, Search, Download, X, Workflow, Github, FileText,
} from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { Language } from '@/types';
import type { ChatTurn } from '@/hooks/useChat';
import { StoryboardPlayer } from '@/components/StoryboardPlayer';
import { downloadImage } from '@/lib/mediaGenerator';

interface ChatViewProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  language: Language;
  turns: ChatTurn[];
  personaName: string;
  onSendToAutomation: (text: string, providerName?: string) => Promise<void>;
  onExportGist: (text: string) => Promise<string>;
  onExportNotion: (text: string) => Promise<string>;
}

function ActionToast({ message }: { message: string }) {
  return (
    <span className="rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 text-xs font-medium">
      {message}
    </span>
  );
}

export function ChatView({ t, dir, language, turns, personaName, onSendToAutomation, onExportGist, onExportNotion }: ChatViewProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ turnId: string; message: string } | null>(null);

  const showToast = (turnId: string, message: string) => {
    setToast({ turnId, message });
    window.setTimeout(() => setToast(null), 3000);
  };

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
              ${isUser ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-primary-500'}
            `}>
              {isUser ? (
                <User className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1 min-w-0`}>
              {/* RAG + web context badges */}
              {!isUser && !turn.error && !turn.pending && (
                <div className="flex flex-wrap items-center gap-1">
                  {turn.ragUsed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 text-xs font-medium">
                      <Database className="w-3 h-3" />
                      {t.ragUsedBadge}
                    </span>
                  )}
                  {(turn.webContext?.jinaUrls.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 px-2 py-0.5 text-xs font-medium">
                      <Globe className="w-3 h-3" />
                      {t.webContextJina} · {turn.webContext.jinaUrls.length}
                    </span>
                  )}
                  {(turn.webContext?.knowledgeCount ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                      <GraduationCap className="w-3 h-3" />
                      {t.webContextKnowledge} · {turn.webContext.knowledgeCount}
                    </span>
                  )}
                  {turn.webContext?.tavilyUsed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 text-xs font-medium">
                      <Search className="w-3 h-3" />
                      {t.webContextTavily}
                    </span>
                  )}
                </div>
              )}
              <div className={`
                rounded-2xl px-4 py-2.5 text-sm max-w-full
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
                    <span className="text-neutral-500">{turn.mediaStatus ?? t.thinking}</span>
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

                {/* Generated image */}
                {turn.media?.kind === 'image' && (
                  <div className="mt-2.5 space-y-1.5">
                    <button
                      onClick={() => setLightboxUrl(turn.media.kind === 'image' ? turn.media.url : null)}
                      className="block max-w-full rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 hover:opacity-95 transition-opacity"
                    >
                      <img
                        src={turn.media.url}
                        alt={turn.media.prompt}
                        className="max-h-96 w-auto object-contain"
                        loading="lazy"
                      />
                    </button>
                    <button
                      onClick={() => void downloadImage(turn.media.url, 'omnifree-image.png').catch(() => undefined)}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 px-2.5 py-1 text-xs font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      {t.downloadPng}
                    </button>
                  </div>
                )}

                {/* Motion storyboard player */}
                {turn.media?.kind === 'storyboard' && (
                  <div className="mt-2.5">
                    <StoryboardPlayer t={t} dir={dir} language={language} storyboard={turn.media} />
                  </div>
                )}

                {/* Video status line (cloud text-to-video pipeline state) */}
                {turn.media?.kind === 'video-status' && (
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {turn.media.status}: {turn.media.detail}
                  </p>
                )}
              </div>

              {/* Provider info + response actions */}
              {!isUser && !turn.pending && !turn.error && (
                <div className="flex items-center gap-2 px-1 flex-wrap">
                  {turn.providerName && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {turn.providerName} · {turn.elapsedMs}ms
                    </p>
                  )}
                  {toast?.turnId === turn.id && <ActionToast message={toast.message} />}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        void onSendToAutomation(turn.content, turn.providerName)
                          .then(() => showToast(turn.id, t.automationSent))
                          .catch(() => showToast(turn.id, t.automationFailed))
                      }
                      title={t.sendToAutomation}
                      className="p-1 rounded text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <Workflow className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        void onExportGist(turn.content)
                          .then((url) => showToast(turn.id, url.startsWith('http') ? `${t.gistCreated} · ${url}` : t.gistCreated))
                          .catch(() => showToast(turn.id, t.automationFailed))
                      }
                      title={t.exportGist}
                      className="p-1 rounded text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        void onExportNotion(turn.content)
                          .then(() => showToast(turn.id, t.notionCreated))
                          .catch(() => showToast(turn.id, t.automationFailed))
                      }
                      title={t.exportNotion}
                      className="p-1 rounded text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Full-screen lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 end-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
          <button
            onClick={(e) => { e.stopPropagation(); void downloadImage(lightboxUrl, 'omnifree-image.png').catch(() => undefined); }}
            className="absolute bottom-6 inline-flex items-center gap-1.5 rounded-lg bg-white text-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t.downloadPng}
          </button>
        </div>
      )}
    </div>
  );
}
