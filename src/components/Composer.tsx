// ============================================================================
// Composer — Chat input with live AI provider switcher, + attachment menu,
// RAG status and removable file chips (Phase 10)
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send, Square, Database, Trash2, Plus, Zap, ZapOff,
  FileText, Image as ImageIcon, Presentation, FileSpreadsheet,
  BookMarked, X, Loader2, ChevronDown, Lock, RefreshCw,
} from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { ProviderConfig } from '@/types';
import { getDefinition } from '@/lib/providers';
import type { Attachment } from '@/hooks/useChat';
import type { MediaMode, AspectRatio, VideoMode } from '@/lib/mediaGenerator';
import { Image as ImageIcon2, Film, MessageSquare, Globe } from 'lucide-react';

interface ComposerProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  providers: ProviderConfig[];
  activeProviderId: string;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onSelectProvider: (id: string) => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  onClear: () => void;
  isLoading: boolean;
  isParsing: boolean;
  parseProgress: number;
  parseFileName: string;
  onFilesSelected: (files: File[]) => void;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  ragActive: boolean;
  ragSnippetCount: number;
  onOpenPrompts: () => void;
  mediaMode: MediaMode;
  onMediaModeChange: (mode: MediaMode) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  videoMode: VideoMode;
  onVideoModeChange: (mode: VideoMode) => void;
}

type PlusMenuAction = 'pptx' | 'pdf' | 'docs' | 'image' | 'prompt';

const ACCEPT_MAP: Record<Exclude<PlusMenuAction, 'prompt'>, string> = {
  pptx: '.pptx,.ppt',
  pdf: '.pdf',
  docs: '.docx,.txt,.md,.csv',
  image: '.png,.jpg,.jpeg,.webp',
};

export function Composer({
  t, dir, providers, activeProviderId, autoRotate, onToggleAutoRotate,
  onSelectProvider, onSend, onStop, onClear, isLoading, isParsing,
  parseProgress, parseFileName, onFilesSelected, attachments, onRemoveAttachment,
  ragActive, ragSnippetCount, onOpenPrompts,
  mediaMode, onMediaModeChange, aspectRatio, onAspectRatioChange, videoMode, onVideoModeChange,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [plusOpen, setPlusOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const hiddenInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const activeDef = activeProvider ? getDefinition(activeProvider.id) : undefined;
  const availableProviders = providers.filter((p) => p.enabled && p.apiKey.trim());

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (plusOpen && plusMenuRef.current && !plusMenuRef.current.contains(target)) {
        setPlusOpen(false);
      }
      if (providerOpen && providerMenuRef.current && !providerMenuRef.current.contains(target)) {
        setProviderOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [plusOpen, providerOpen]);

  const handleSend = useCallback(() => {
    if (isLoading || isParsing) return;
    if (!text.trim() && attachments.length === 0) return;
    onSend(text.trim(), attachments);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, isLoading, isParsing, onSend, attachments]);

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

  const handlePlusAction = useCallback((action: PlusMenuAction) => {
    setPlusOpen(false);
    if (action === 'prompt') {
      onOpenPrompts();
      return;
    }
    hiddenInputs.current[action]?.click();
  }, [onOpenPrompts]);

  const providerName = activeProvider?.name ?? (availableProviders[0]?.name || t.noActiveProvider);

  const PLUS_ITEMS: Array<{ action: PlusMenuAction; icon: typeof FileText; label: string }> = [
    { action: 'pptx', icon: Presentation, label: t.uploadPptx },
    { action: 'pdf', icon: FileText, label: t.uploadPdf },
    { action: 'docs', icon: FileSpreadsheet, label: t.uploadDocText },
    { action: 'image', icon: ImageIcon, label: t.uploadImage },
    { action: 'prompt', icon: BookMarked, label: t.insertPrompt },
  ];

  const MODE_ITEMS: Array<{ mode: MediaMode; icon: typeof MessageSquare; label: string }> = [
    { mode: 'chat', icon: MessageSquare, label: t.modeChat },
    { mode: 'image', icon: ImageIcon2, label: t.modeImage },
    { mode: 'video', icon: Film, label: t.modeVideo },
  ];

  return (
    <div dir={dir} className="border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3">
      {/* Media generation mode selector pill (Phase 10B) */}
      <div className="flex items-center justify-between mb-2 px-1 gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 p-0.5">
          {MODE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = mediaMode === item.mode;
            return (
              <button
                key={item.mode}
                onClick={() => onMediaModeChange(item.mode)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
          {mediaMode === 'chat' && <Globe className="w-3 h-3 text-neutral-400 ms-1 me-1" />}
        </div>

        {mediaMode === 'image' && (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{t.aspectRatio}</span>
            {(['1:1', '16:9', '9:16'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                onClick={() => onAspectRatioChange(ratio)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                  aspectRatio === ratio
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        )}

        {mediaMode === 'video' && (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{t.videoMode}</span>
            <button
              onClick={() => onVideoModeChange('ai-video')}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                videoMode === 'ai-video'
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {t.aiVideo}
            </button>
            <button
              onClick={() => onVideoModeChange('motion-storyboard')}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                videoMode === 'motion-storyboard'
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {t.motionStoryboard}
            </button>
          </div>
        )}
      </div>

      {/* RAG status + provider pill row */}
      <div className="flex items-center justify-between mb-2 px-1 gap-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          {ragActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 font-medium flex-shrink-0">
              <Database className="w-3 h-3" />
              {t.ragActive}
              {ragSnippetCount > 0 && ` · ${ragSnippetCount}`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-0.5 font-medium flex-shrink-0">
              <Database className="w-3 h-3" />
              {t.ragInactive}
            </span>
          )}

          {/* Provider badge + switcher pill */}
          <div ref={providerMenuRef} className="relative min-w-0">
            <button
              onClick={() => setProviderOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 font-medium max-w-[220px] hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
            >
              {isLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : (activeProvider || availableProviders.length > 0)
                  ? <Zap className="w-3.5 h-3.5" />
                  : <ZapOff className="w-3.5 h-3.5" />}
              <span className="truncate">{providerName}</span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>

            {providerOpen && (
              <div className="absolute bottom-full mb-2 start-0 z-50 w-72 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">{t.providerLabel}</span>
                  <button
                    onClick={onToggleAutoRotate}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                      autoRotate
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400'
                        : 'bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-400'
                    }`}
                  >
                    {autoRotate ? <RefreshCw className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {autoRotate ? t.autoRotate : t.manual}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {availableProviders.length === 0 && (
                    <p className="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400">{t.noProvidersDesc}</p>
                  )}
                  {availableProviders.map((provider) => {
                    const def = getDefinition(provider.id);
                    const isActive = provider.id === activeProviderId;
                    return (
                      <button
                        key={provider.id}
                        onClick={() => {
                          onSelectProvider(provider.id);
                          setProviderOpen(false);
                        }}
                        className={`w-full text-start flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400'
                            : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate font-medium">{provider.name}</span>
                          <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{provider.model}</span>
                        </span>
                        {def?.freeTier && (
                          <span className="text-[10px] uppercase font-semibold text-success-600 dark:text-success-400 flex-shrink-0">free</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClear}
          className="text-xs text-neutral-400 hover:text-error-600 dark:hover:text-error-400 transition-colors inline-flex items-center gap-1 flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" />
          {t.clearChat}
        </button>
      </div>

      {/* Parsing progress bar */}
      {isParsing && (
        <div className="mb-2 px-1">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="truncate">{t.parsingFile} {parseFileName}</span>
            <span className="font-medium tabular-nums">{parseProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${Math.max(parseProgress, 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-200 max-w-[240px]"
            >
              {attachment.kind === 'image'
                ? <ImageIcon className="w-3 h-3 flex-shrink-0" />
                : <FileText className="w-3 h-3 flex-shrink-0" />}
              <span className="truncate">{attachment.name}</span>
              <button
                onClick={() => onRemoveAttachment(attachment.id)}
                className="rounded-full p-0.5 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      {(Object.keys(ACCEPT_MAP) as Array<Exclude<PlusMenuAction, 'prompt'>>).map((action) => (
        <input
          key={action}
          ref={(el) => { hiddenInputs.current[action] = el; }}
          type="file"
          accept={ACCEPT_MAP[action]}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onFilesSelected(files);
            e.target.value = '';
          }}
        />
      ))}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* + multi-action menu */}
        <div ref={plusMenuRef} className="relative flex-shrink-0">
          <button
            onClick={() => setPlusOpen((open) => !open)}
            disabled={isParsing}
            className="
              flex items-center justify-center w-10 h-10 rounded-xl
              bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300
              hover:bg-neutral-200 dark:hover:bg-neutral-700
              disabled:opacity-40 transition-colors
            "
          >
            <Plus className="w-5 h-5" />
          </button>

          {plusOpen && (
            <div className="absolute bottom-full mb-2 start-0 z-50 w-64 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg overflow-hidden">
              {PLUS_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.action}
                    onClick={() => handlePlusAction(item.action)}
                    className="w-full text-start flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-neutral-400" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
            disabled={(!text.trim() && attachments.length === 0) || isParsing}
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
      {/* activeDef kept for future per-provider icon theming */}
      <span className="hidden">{activeDef?.name}</span>
    </div>
  );
}
