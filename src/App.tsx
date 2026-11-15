// ============================================================================
// App — OmniFree AI Studio (Phases 1-8)
// ============================================================================

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Sidebar, type SidebarView } from '@/components/Sidebar';
import { ChatView } from '@/components/ChatView';
import { Composer } from '@/components/Composer';
import { KnowledgePanel } from '@/components/KnowledgePanel';
import { ProvidersPanel } from '@/components/ProvidersPanel';
import { PersonasPanel } from '@/components/PersonasPanel';
import { PromptsPanel } from '@/components/PromptsPanel';
import { useChat } from '@/hooks/useChat';
import { useDocuments } from '@/hooks/useDocuments';
import { useProviders } from '@/hooks/useProviders';
import { useSettings } from '@/hooks/useSettings';
import { getTranslation } from '@/lib/i18n';
import { loadPersonas, savePersonas, getPersonaById, loadPrompts, savePrompts } from '@/lib/personas';
import { retrieveContext } from '@/lib/retrieval';
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

  const { turns, isLoading, sendMessage, stopGeneration, clearChat } = useChat({
    providers,
    persona: activePersona,
  });

  // RAG status — check if any enabled documents exist
  const ragActive = docs.documents.some((d) => d.enabled && d.status === 'ready');

  // Check RAG snippet count when documents change
  useEffect(() => {
    if (!ragActive) {
      setRagSnippetCount(0);
      return;
    }
    // Get chunk count from enabled documents
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

  const handleUsePrompt = useCallback((_body: string) => {
    setActiveView('chat');
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
              onSend={sendMessage}
              onStop={stopGeneration}
              onClear={clearChat}
              isLoading={isLoading}
              ragActive={ragActive}
              ragSnippetCount={ragSnippetCount}
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
      </main>
    </div>
  );
}
