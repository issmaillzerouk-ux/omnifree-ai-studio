// ============================================================================
// useChat — Chat hook with intent orchestration, web context, multimodal
// media, document export actions and persistent sessions (Phases 8-10C)
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage, ChatContentPart, ProviderResponse, ProviderConfig, SystemPersona,
  WebContextBadge, TurnMedia, PersistedConversation,
} from '@/types';
import { sendChatWithFallback } from '@/lib/router';
import { retrieveContext, buildRagContextString } from '@/lib/retrieval';
import { generateId } from '@/lib/documentStore';
import { saveConversation, getAllConversations, deleteConversation } from '@/lib/chatStore';
import type { MediaMode, AspectRatio, VideoMode, GeneratedImage, Storyboard } from '@/lib/mediaGenerator';
import { generateImage, generateStoryboard } from '@/lib/mediaGenerator';
import {
  isConnectorConnected,
  getConnectorKey,
  extractUrls,
  fetchViaJina,
  searchOpenKnowledge,
  tavilySearch,
  searchGptGrounding,
  findRealPhotos,
  type ConnectorId,
} from '@/lib/connectors';
import { detectIntent, translateToEnglishVisualPrompt, detectPromptLanguage } from '@/lib/intentRouter';
import type { ExportFormat } from '@/lib/docExport';

const CONVO_STORAGE_KEY = 'omnifree-active-conversation';

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerName?: string;
  elapsedMs?: number;
  ragUsed?: boolean;
  error?: string;
  pending?: boolean;
  media?: TurnMedia;
  mediaStatus?: string;
  webContext?: WebContextBadge;
  /** One-click PPTX / DOCX / PDF export actions on document responses. */
  exportActions?: ExportFormat[];
}

export interface Attachment {
  id: string;
  name: string;
  kind: 'text' | 'image';
  text?: string;
  dataUrl?: string;
  /** Extraction stats shown on the chip. */
  charCount?: number;
  pageCount?: number;
}

export interface ConnectorState {
  connected: Partial<Record<ConnectorId, boolean>>;
  keys: Partial<Record<ConnectorId, string>>;
}

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface SendMediaOptions {
  mediaMode: MediaMode;
  aspect: AspectRatio;
  videoMode: VideoMode;
  language: 'en' | 'ar';
}

export interface UseChatOptions {
  providers: ProviderConfig[];
  persona: SystemPersona;
  autoRotate: boolean;
  manualProviderId?: string;
  connectorState: ConnectorState;
}

function updateTurn(
  setTurns: React.Dispatch<React.SetStateAction<ChatTurn[]>>,
  turnId: string,
  updates: Partial<ChatTurn>,
): void {
  setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, ...updates } : t)));
}

export function useChat({ providers, persona, autoRotate, manualProviderId, connectorState }: UseChatOptions) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convoIdRef = useRef<string>(generateId());
  const connectorRef = useRef(connectorState);
  connectorRef.current = connectorState;

  // -------------------------------------------------------------------------
  // Session management — recent chats list (Phase 10C)
  // -------------------------------------------------------------------------
  const refreshSessions = useCallback(async (): Promise<void> => {
    try {
      const all = await getAllConversations();
      setSessions(
        all
          .filter((c) => c.turns.length > 0)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 30)
          .map((c) => ({ id: c.id, title: c.title || 'Conversation', updatedAt: c.updatedAt })),
      );
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions, turns]);

  const loadSession = useCallback((convo: PersistedConversation): void => {
    convoIdRef.current = convo.id;
    localStorage.setItem(CONVO_STORAGE_KEY, JSON.stringify(convo));
    setTurns(
      convo.turns.map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content,
        providerName: t.providerName,
        elapsedMs: t.elapsedMs,
        ragUsed: t.ragUsed,
        error: t.error,
      })),
    );
  }, []);

  const newSession = useCallback((): void => {
    convoIdRef.current = generateId();
    localStorage.setItem(
      CONVO_STORAGE_KEY,
      JSON.stringify({ id: convoIdRef.current, title: '', turns: [], createdAt: Date.now(), updatedAt: Date.now() }),
    );
    setTurns([]);
  }, []);

  const deleteSession = useCallback((id: string): void => {
    void deleteConversation(id).then(() => refreshSessions());
    if (convoIdRef.current === id) {
      newSession();
    }
  }, [newSession, refreshSessions]);

  // -------------------------------------------------------------------------
  // Autosave the active conversation whenever turns settle (Phase 9)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const finished = turns.filter((t) => !t.pending);
    if (finished.length === 0) return;
    const existing = localStorage.getItem(CONVO_STORAGE_KEY);
    let convo: PersistedConversation;
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as PersistedConversation;
        convo = parsed.id === convoIdRef.current
          ? parsed
          : { id: convoIdRef.current, title: '', turns: [], createdAt: Date.now(), updatedAt: Date.now() };
      } catch {
        convo = { id: convoIdRef.current, title: '', turns: [], createdAt: Date.now(), updatedAt: Date.now() };
      }
    } else {
      convo = { id: convoIdRef.current, title: '', turns: [], createdAt: Date.now(), updatedAt: Date.now() };
    }
    const persisted = finished.map((t) => ({
      id: t.id,
      role: t.role,
      content: t.content,
      providerName: t.providerName,
      elapsedMs: t.elapsedMs,
      ragUsed: t.ragUsed,
      error: t.error,
    }));
    const firstUser = persisted.find((t) => t.role === 'user');
    const title = firstUser ? firstUser.content.slice(0, 60) : 'Conversation';
    const next: PersistedConversation = {
      ...convo,
      turns: persisted,
      title,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CONVO_STORAGE_KEY, JSON.stringify(next));
    saveConversation(next).catch(() => {
      // non-fatal
    });
  }, [turns]);

  /** Single-shot LLM call used by the storyboard director and translator. */
  const callLLM = useCallback(async (prompt: string): Promise<string> => {
    const controller = new AbortController();
    abortRef.current = controller;
    const response: ProviderResponse = await sendChatWithFallback(
      providers,
      [
        { role: 'system', content: persona.systemPrompt },
        { role: 'user', content: prompt },
      ],
      controller.signal,
    );
    return response.text;
  }, [providers, persona]);

  // -------------------------------------------------------------------------
  // Web context — Jina reader + Open Knowledge + Tavily + SearchGPT
  // -------------------------------------------------------------------------
  const buildWebContext = useCallback(async (userText: string): Promise<{ badge: WebContextBadge; context: string }> => {
    const state = connectorRef.current;
    const badge: WebContextBadge = { jinaUrls: [], knowledgeCount: 0, tavilyUsed: false };
    const sections: string[] = [];

    if (isConnectorConnected(state, 'jina')) {
      const urls = extractUrls(userText).slice(0, 2);
      for (const url of urls) {
        try {
          const markdown = await fetchViaJina(url);
          sections.push(`--- Live web content from ${url} ---\n${markdown}`);
          badge.jinaUrls.push(url);
        } catch {
          // reader failure is non-fatal
        }
      }
    }

    if (isConnectorConnected(state, 'openscience') && userText.trim().length > 2) {
      try {
        const snippets = await searchOpenKnowledge(userText);
        if (snippets.length > 0) {
          badge.knowledgeCount = snippets.length;
          sections.push(
            snippets.map((s) => `--- ${s.source}: ${s.title} ---\n${s.text}`).join('\n\n'),
          );
        }
      } catch {
        // knowledge failure is non-fatal
      }
    }

    const tavilyKey = getConnectorKey(state, 'tavily');
    if (isConnectorConnected(state, 'tavily') && tavilyKey && userText.trim().length > 2) {
      try {
        const result = await tavilySearch(tavilyKey, userText);
        if (result) {
          badge.tavilyUsed = true;
          sections.push(`--- Tavily web search ---\n${result}`);
        }
      } catch {
        // search failure is non-fatal
      }
    }

    if (sections.length === 0 && userText.trim().length > 2 && isConnectorConnected(state, 'searchgpt')) {
      try {
        const grounding = await searchGptGrounding(userText);
        if (grounding) {
          sections.push(`--- SearchGPT web grounding ---\n${grounding}`);
        }
      } catch {
        // grounding failure is non-fatal
      }
    }

    return { badge, context: sections.join('\n\n') };
  }, []);

  const sendMessage = useCallback(
    async (userText: string, attachments: Attachment[] = [], media?: SendMediaOptions): Promise<void> => {
      if (isLoading) return;
      if (!userText.trim() && attachments.length === 0) return;
      setIsLoading(true);

      const language = detectPromptLanguage(userText);

      const userTurn: ChatTurn = {
        id: `${Date.now()}-u`,
        role: 'user',
        content: userText || attachments.map((a) => a.name).join(', '),
      };
      setTurns((prev) => [...prev, userTurn]);

      const assistantTurn: ChatTurn = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: '',
        pending: true,
      };
      setTurns((prev) => [...prev, assistantTurn]);
      const assistantId = assistantTurn.id;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const attachmentText = attachments
          .filter((a) => a.kind === 'text' && a.text)
          .map((a) => `--- Attached file: ${a.name} (${a.charCount ?? a.text.length} characters) ---\n${a.text}`)
          .join('\n\n');
        const imageAttachments = attachments.filter((a) => a.kind === 'image' && a.dataUrl);

        // ------------------------------------------------------------
        // INTENT DETECTION — orchestrates the pipeline (Phase 10C)
        // ------------------------------------------------------------
        const intent = detectIntent(userText);

        // IMAGE intent — Nano Banana (Gemini native image) + Flux HD via key,
        // guaranteed Pollinations fallback, Wikimedia/Openverse for real photos
        if (intent.intent === 'image' && imageAttachments.length === 0) {
          updateTurn(setTurns, assistantId, {
            mediaStatus: language === 'ar' ? 'جارٍ توليد الصورة…' : 'Generating image…',
          });

          const visualPrompt = await translateToEnglishVisualPrompt(callLLM, userText);
          const state = connectorRef.current;

          if (intent.wantsRealPhotos && isConnectorConnected(state, 'photofinder')) {
            const photos = await findRealPhotos(visualPrompt);
            if (photos.length > 0) {
              updateTurn(setTurns, assistantId, {
                content: visualPrompt,
                media: { kind: 'image', url: photos[0].url, prompt: visualPrompt, providerName: photos[0].source },
                pending: false,
              });
              return;
            }
          }

          const image: GeneratedImage = await generateImage(visualPrompt, {
            aspect: media?.aspect ?? '1:1',
            huggingFaceKey: getConnectorKey(state, 'huggingface') || undefined,
            pollinationsConnected: isConnectorConnected(state, 'pollinations'),
          });
          updateTurn(setTurns, assistantId, {
            content: visualPrompt,
            media: { kind: 'image', url: image.url, prompt: visualPrompt, providerName: image.providerName },
            pending: false,
          });
          return;
        }

        // VIDEO intent — narrated motion storyboard engine
        if (intent.intent === 'video') {
          updateTurn(setTurns, assistantId, {
            mediaStatus: language === 'ar' ? 'جارٍ إخراج اللوحة…' : 'Directing storyboard…',
          });
          const state = connectorRef.current;
          const storyboard: Storyboard = await generateStoryboard(callLLM, userText, {
            aspect: media?.aspect ?? '16:9',
            huggingFaceKey: getConnectorKey(state, 'huggingface') || undefined,
            pollinationsConnected: isConnectorConnected(state, 'pollinations'),
            language: language === 'ar' ? 'ar' : 'en',
          });
          updateTurn(setTurns, assistantId, {
            content: language === 'ar' ? storyboard.titleAr : storyboard.titleEn,
            media: { kind: 'storyboard', ...storyboard },
            pending: false,
          });
          return;
        }

        // ------------------------------------------------------------
        // CHAT / WEB / DOCUMENT — context-enriched LLM response
        // ------------------------------------------------------------
        let ragContext = '';
        let ragUsed = false;
        try {
          const results = await retrieveContext(userText);
          if (results.length > 0) {
            ragContext = buildRagContextString(results);
            ragUsed = true;
          }
        } catch {
          // RAG failure is non-fatal — proceed without context
        }

        const web = await buildWebContext(userText);

        const contextBlocks = [ragContext, attachmentText, web.context].filter(Boolean).join('\n\n');
        const systemContent = contextBlocks
          ? `${persona.systemPrompt}\n\n${contextBlocks}`
          : persona.systemPrompt;

        const attachmentParts: ChatContentPart[] = imageAttachments.map((a) => ({
          type: 'image' as const,
          imageUrl: a.dataUrl ?? '',
        }));
        const userContent: ChatMessage['content'] =
          attachmentParts.length > 0
            ? [
                ...attachmentParts,
                { type: 'text' as const, text: userText + (attachmentText ? `\n\n${attachmentText}` : '') },
              ]
            : userText;

        const historyMessages: ChatMessage[] = turns.map((t) => ({
          role: t.role,
          content: t.content,
        }));

        const messages: ChatMessage[] = [
          { role: 'system', content: systemContent },
          ...historyMessages,
          { role: 'user', content: userContent },
        ];

        const response: ProviderResponse = await sendChatWithFallback(
          providers,
          messages,
          controller.signal,
          {
            manualProviderId: autoRotate ? undefined : manualProviderId,
          },
        );

        const exportActions: ExportFormat[] | undefined =
          intent.intent === 'document' ? ['pptx', 'docx', 'pdf'] : undefined;

        updateTurn(setTurns, assistantId, {
          content: response.text,
          providerName: response.providerName,
          elapsedMs: response.elapsedMs,
          ragUsed,
          webContext: web.badge,
          exportActions,
          pending: false,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to get response';
        const isObj = typeof err === 'object' && err !== null && 'message' in err;
        const msg = isObj ? (err as { message: string }).message : errMsg;
        updateTurn(setTurns, assistantId, { content: '', error: msg, pending: false });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [turns, providers, persona, isLoading, autoRotate, manualProviderId, buildWebContext, callLLM],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = useCallback(() => {
    localStorage.removeItem(CONVO_STORAGE_KEY);
    convoIdRef.current = generateId();
    setTurns([]);
  }, []);

  return {
    turns, isLoading, sendMessage, stopGeneration, clearChat,
    sessions, loadSession, newSession, deleteSession,
  };
}

export type { Attachment };
