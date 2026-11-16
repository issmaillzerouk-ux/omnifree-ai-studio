// ============================================================================
// App — OmniFree AI Studio (Phases 1-10)
// ============================================================================

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Sidebar, type SidebarView } from '@/components/Sidebar';
import { ChatView } from '@/components/ChatView';
import { Composer } from '@/components/Composer';
import { KnowledgePanel } from '@/components/KnowledgePanel';
import { ProvidersPanel } from '@/components/ProvidersPanel';
import { PersonasPanel } from '@/components/PersonasPanel';
import { PromptsPanel } from '@/components/PromptsPanel';
import { BackupSettings } from '@/components/BackupSettings';
import { useChat } from '@/hooks/useChat';
import { useDocuments } from '@/hooks/useDocuments';
import { useProviders } from '@/hooks/useProviders';
import { useSettings } from '@/hooks/useSettings';
import { getTranslation } from '@/lib/i18n';
import { loadPersonas, savePersonas, getPersonaById, loadPrompts, savePrompts } from '@/lib/personas';
import { retrieveContext } from '@/lib/retrieval';
import { clearAllConversations } from '@/lib/chatStore';
import { clearAllDocuments, saveDocument, saveChunks, generateId } from '@/lib/documentStore';
import { detectFormat, parseFile, parseImage, ParseErrorImpl } from '@/lib/fileParsers';
import { chunkText } from '@/lib/textChunker';
import type { Attachment } from '@/hooks/useChat';
import type { SystemPersona, PromptSnippet } from '@/types';
import { Database } from 'lucide-react';

export function App() {
  const { settings, update, toggleLanguage } = useSettings();
  const { providers, update: updateProvider, add: addProvider, remove: removeProvider } = useProviders();
  const docs = useDocuments();
  const [activeView, setActiveView] = useState<SidebarView>('chat');
  const [personas, setPersonas] = useState<SystemPersona[]>([]);
  const [prompts, setPrompts] = useState<PromptSnippet[]>([]);
  const [ragSnippetCount, setRagSnippetCount] = useState(0);

  // Load personas & prompts
  useEffect(() => {
    setPersonas(loadPersonas());
    setPrompts(loadPrompts());
  }, []);

  // Theme init
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const t = useMemo(() => getTranslation(settings.language), [settings.language]);
  const dir = settings.language === 'ar' ? 'rtl' : 'ltr';

  const activePersona = useMemo(
    () => getPersonaById(personas, settings.activePersonaId),
    [personas, settings.activePersonaId],
  );

  const activeProviderId = useMemo(
    () => providers.find((p) => p.enabled && p.apiKey.trim())?.id ?? '',
    [providers],
  );

  const { turns, isLoading, sendMessage, stopGeneration, clearChat } = useChat({
    providers,
    persona: activePersona,
    autoRotate: settings.autoRotate,
    manualProviderId: settings.manualProviderId,
  });

  // Attachment parsing state (Phase 10)
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseFileName, setParseFileName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  // RAG status — check if any enabled documents exist
  const ragActive = docs.documents.some((d) => d.enabled && d.status === 'ready');

  useEffect(() => {
    if (!ragActive) {
      setRagSnippetCount(0);
      return;
    }
    let count = 0;
    docs.documents
      .filter((d) => d.enabled && d.status === 'ready')
      .forEach((d) => {
        count += d.chunkCount;
      });
    setRagSnippetCount(count);
  }, [docs.documents, ragActive]);

  // Personas handlers
  const handleSelectPersona = useCallback((id: string) => {
    update({ activePersonaId: id });
    setActiveView('chat');
  }, [update]);

  const handleAddPersona = useCallback((persona: SystemPersona) => {
    setPersonas((prev) => {
      const next = [...prev, persona];
      savePersonas(next);
      return next;
    });
  }, []);

  const handleRemovePersona = useCallback((id: string) => {
    setPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePersonas(next);
      return next;
    });
  }, []);

  // Prompts handlers
  const handleAddPrompt = useCallback((prompt: PromptSnippet) => {
    setPrompts((prev) => {
      const next = [...prev, prompt];
      savePrompts(next);
      return next;
    });
  }, []);

  const handleRemovePrompt = useCallback((id: string) => {
    setPrompts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePrompts(next);
      return next;
    });
  }, []);

  const handleFactoryReset = useCallback(async (): Promise<void> => {
    await clearAllConversations();
    await clearAllDocuments();
    localStorage.removeItem('omnifree-providers');
    localStorage.removeItem('omnifree-personas');
    localStorage.removeItem('omnifree-prompts');
    localStorage.removeItem('omnifree-active-conversation');
    setPersonas(loadPersonas());
    setPrompts(loadPrompts());
    await docs.refresh();
  }, [docs]);

  const handleUsePrompt = useCallback((_body: string) => {
    setActiveView('chat');
  }, []);

  // Attachment handling — parse, chip, optionally index into RAG (Phase 10)
  const handleFilesSelected = useCallback(async (files: File[]): Promise<void> => {
    for (const file of files) {
      const format = detectFormat(file.name);
      if (format === 'image') {
        try {
          const { dataUrl } = await parseImage(file);
          setPendingAttachments((prev) => [
            ...prev,
            { id: generateId(), name: file.name, kind: 'image', dataUrl },
          ]);
        } catch (err) {
          docs.setError(err instanceof Error ? err.message : 'Failed to read image');
        }
        continue;
      }

      setIsParsing(true);
      setParseProgress(0);
      setParseFileName(file.name);
      try {
        const result = await parseFile(file, (percent) => setParseProgress(percent));
        setPendingAttachments((prev) => [
          ...prev,
          { id: generateId(), name: file.name, kind: 'text', text: result.text },
        ]);
        // Best-effort indexing into the local RAG store (disabled by default)
        try {
          const docId = generateId();
          await saveDocument({
            id: docId,
            name: file.name,
            format: result.format,
            sizeBytes: file.size,
            chunkCount: 0,
            status: 'processing',
            enabled: false,
            uploadedAt: Date.now(),
          });
          const chunks = chunkText(result.text, docId);
          if (chunks.length > 0) {
            await saveChunks(chunks);
            await saveDocument({
              id: docId,
              name: file.name,
              format: result.format,
              sizeBytes: file.size,
              chunkCount: chunks.length,
              status: 'ready',
              enabled: false,
              uploadedAt: Date.now(),
            });
          }
        } catch {
          // RAG indexing is best-effort; the attachment still works
        }
      } catch (err) {
        const msg = err instanceof ParseErrorImpl
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to parse file';
        docs.setError(msg);
      } finally {
        setIsParsing(false);
        setParseProgress(0);
        setParseFileName('');
      }
    }
  }, [docs]);

  const handleSendWithAttachments = useCallback(
    (text: string, composerAttachments: Attachment[]) => {
      const merged = [...pendingAttachments, ...composerAttachments];
      setPendingAttachments([]);
      void sendMessage(text, merged);
    },
    [pendingAttachments, sendMessage],
  );

  const handleToggleAutoRotate = useCallback(() => {
    update({ autoRotate: !settings.autoRotate });
  }, [settings.autoRotate, update]);

  const handleSelectChatProvider = useCallback(
    (id: string) => {
      update({ manualProviderId: id, autoRotate: false });
    },
    [update],
  );

  const handleOpenPrompts = useCallback(() => {
    setActiveView('prompts');
  }, []);

  // Theme toggle
  const handleToggleTheme = useCallback(() => {
    update({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }, [settings.theme, update]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-neutral-900">
      <Sidebar
        t={t}
        dir={dir}
        activeView={activeView}
        onViewChange={setActiveView}
        language={settings.language}
        onToggleLanguage={toggleLanguage}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {activeView === 'chat' && (
          <>
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">{t.chat}</h1>
                <span className="text-sm text-neutral-400">·</span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">{activePersona.name}</span>
              </div>
              {ragActive && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400 px-2 py-0.5 font-medium">
                    <Database className="w-3 h-3" />
                    {t.ragActive}
                  </span>
                </div>
              )}
            </div>
            <ChatView t={t} dir={dir} turns={turns} personaName={activePersona.name} />
            <Composer
              t={t}
              dir={dir}
              providers={providers}
              activeProviderId={settings.manualProviderId || activeProviderId}
              autoRotate={settings.autoRotate}
              onToggleAutoRotate={handleToggleAutoRotate}
              onSelectProvider={handleSelectChatProvider}
              onSend={handleSendWithAttachments}
              onStop={stopGeneration}
              onClear={clearChat}
              isLoading={isLoading}
              isParsing={isParsing}
              parseProgress={parseProgress}
              parseFileName={parseFileName}
              onFilesSelected={handleFilesSelected}
              attachments={pendingAttachments}
              onRemoveAttachment={(id) => setPendingAttachments((prev) => prev.filter((a) => a.id !== id))}
              ragActive={ragActive}
              ragSnippetCount={ragSnippetCount}
              onOpenPrompts={handleOpenPrompts}
            />
          </>
        )}

        {activeView === 'knowledge' && (
          <KnowledgePanel
            t={t}
            dir={dir}
            documents={docs.documents}
            isLoading={docs.isLoading}
            error={docs.error}
            onAddFile={docs.addFile}
            onRemove={docs.removeDocument}
            onToggle={docs.toggleEnabled}
            onClearError={docs.clearError}
          />
        )}

        {activeView === 'providers' && (
          <ProvidersPanel
            t={t}
            dir={dir}
            providers={providers}
            onUpdate={updateProvider}
            onAdd={addProvider}
            onRemove={removeProvider}
          />
        )}

        {activeView === 'personas' && (
          <PersonasPanel
            t={t}
            dir={dir}
            personas={personas}
            activePersonaId={settings.activePersonaId}
            onSelect={handleSelectPersona}
            onAdd={handleAddPersona}
            onRemove={handleRemovePersona}
          />
        )}

        {activeView === 'prompts' && (
          <PromptsPanel
            t={t}
            dir={dir}
            prompts={prompts}
            onAdd={handleAddPrompt}
            onRemove={handleRemovePrompt}
            onUse={handleUsePrompt}
          />
        )}

        {activeView === 'backup' && (
          <BackupSettings t={t} dir={dir} onFactoryReset={handleFactoryReset} />
        )}
      </main>
    </div>
  );
}
