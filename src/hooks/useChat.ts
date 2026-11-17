// ============================================================================
// useChat — Chat hook with RAG, web context & multimodal media (Phases 8-10B)
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatContentPart, ProviderResponse, ProviderConfig, SystemPersona, RagContext, WebContextBadge, TurnMedia } from '@/types';
import { sendChatWithFallback } from '@/lib/router';
import { retrieveContext, buildRagContextString } from '@/lib/retrieval';
import { generateId } from '@/lib/documentStore';
import { saveConversation } from '@/lib/chatStore';
import type { PersistedConversation } from '@/types';
import type { Attachment } from '@/hooks/useChat';
import type { MediaMode, AspectRatio, VideoMode, GeneratedImage, Storyboard } from '@/lib/mediaGenerator';
import { generateImage, generateStoryboard } from '@/lib/mediaGenerator';
import {
  isConnectorConnected,
  getConnectorKey,
  extractUrls,
  fetchViaJina,
  searchOpenKnowledge,
  tavilySearch,
} from '@/lib/connectors';

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
}

export interface UseChatOptions {
  providers: ProviderConfig[];
  persona: SystemPersona;
  autoRotate: boolean;
  manualProviderId?: string;
  connectorState: {
    connected: Partial<Record<'pollinations' | 'jina' | 'openscience' | 'tts' | 'tavily' | 'huggingface' | 'automation' | 'github' | 'notion' | 'custom', boolean>>;
    keys: Partial<Record<'pollinations' | 'jina' | 'openscience' | 'tts' | 'tavily' | 'huggingface' | 'automation' | 'github' | 'notion' | 'custom', string>>;
  };
}

export interface SendMediaOptions {
  mediaMode: MediaMode;
  aspect: AspectRatio;
  videoMode: VideoMode;
  language: 'en' | 'ar';
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
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convoIdRef = useRef<string>(generateId());
  const connectorRef = useRef(connectorState);
  connectorRef.current = connectorState;

  // Autosave the active conversation whenever turns settle (Phase 9)
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

  /** Single-shot LLM call used by the storyboard director. */
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
  // Web context enrichment (chat mode) — Jina reader + Open Knowledge + Tavily
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

    return { badge, context: sections.join('\n\n') };
  }, []);

  const sendMessage = useCallback(
    async (userText: string, attachments: Attachment[] = [], media?: SendMediaOptions): Promise<void> => {
      if (isLoading) return;
      if (!userText.trim() && attachments.length === 0) return;
      setIsLoading(true);

      const mode: MediaMode = media?.mediaMode ?? 'chat';
      const language = media?.language ?? 'en';

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
        // --------------------------------------------------------------
        // Image generation mode
        // --------------------------------------------------------------
        if (mode === 'image') {
          updateTurn(setTurns, assistantId, { mediaStatus: language === 'ar' ? 'جارٍ توليد الصورة…' : 'Generating image…' });
          const state = connectorRef.current;
          const image: GeneratedImage = await generateImage(userText, {
            aspect: media?.aspect ?? '1:1',
            huggingFaceKey: getConnectorKey(state, 'huggingface') || undefined,
            pollinationsConnected: isConnectorConnected(state, 'pollinations'),
          });
          updateTurn(setTurns, assistantId, {
            content: userText,
            media: { kind: 'image', url: image.url, prompt: userText, providerName: image.providerName },
            pending: false,
          });
          return;
        }

        // --------------------------------------------------------------
        // Video / motion storyboard mode
        // --------------------------------------------------------------
        if (mode === 'video') {
          const state = connectorRef.current;
          const wantStoryboard = media?.videoMode === 'motion-storyboard' || !getConnectorKey(state, 'huggingface');

          if (wantStoryboard) {
            updateTurn(setTurns, assistantId, {
              mediaStatus: language === 'ar' ? 'جارٍ إخراج اللوحة…' : 'Directing storyboard…',
            });
            const storyboard: Storyboard = await generateStoryboard(callLLM, userText, {
              aspect: media?.aspect ?? '16:9',
              huggingFaceKey: getConnectorKey(state, 'huggingface') || undefined,
              pollinationsConnected: isConnectorConnected(state, 'pollinations'),
              language,
            });
            updateTurn(setTurns, assistantId, {
              content: language === 'ar' ? storyboard.titleAr : storyboard.titleEn,
              media: { kind: 'storyboard', ...storyboard },
              pending: false,
            });
            return;
          }

          // Cloud text-to-video attempt with async polling states
          const hfKey = getConnectorKey(state, 'huggingface');
          updateTurn(setTurns, assistantId, { mediaStatus: 'queued' });
          const response = await fetch(
            'https://router.huggingface.co/hf-inference/models/FRAMEWORK/mochi-1-preview',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hfKey}` },
              body: JSON.stringify({ inputs: userText }),
              signal: controller.signal,
            },
          );
          if (!response.ok) throw new Error(`AI video failed (HTTP ${response.status})`);
          updateTurn(setTurns, assistantId, { mediaStatus: 'processing' });
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          updateTurn(setTurns, assistantId, {
            content: userText,
            media: { kind: 'image', url, prompt: userText, providerName: 'Hugging Face Video' },
            mediaStatus: 'completed',
            pending: false,
          });
          return;
        }

        // --------------------------------------------------------------
        // Chat / Web mode — RAG + live web context
        // --------------------------------------------------------------
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

        const attachmentNote = attachments.length > 0
          ? `\n\n${attachments
              .map((a) => (a.kind === 'text' ? `--- ${a.name} ---\n${a.text ?? ''}` : `[image: ${a.name}]`))
              .join('\n\n')}`
          : '';

        const contextBlocks = [ragContext, web.context].filter(Boolean).join('\n\n');
        const systemContent = contextBlocks
          ? `${persona.systemPrompt}\n\n${contextBlocks}`
          : persona.systemPrompt;

        const attachmentParts = attachments.map((a): ChatContentPart =>
          a.kind === 'image' && a.dataUrl
            ? { type: 'image', imageUrl: a.dataUrl }
            : { type: 'text', text: `--- ${a.name} ---\n${a.text ?? ''}` },
        );
        const userContent: ChatMessage['content'] =
          attachmentParts.length > 0
            ? [...attachmentParts, ...(userText.trim() ? [{ type: 'text' as const, text: userText }] : [])]
            : userText + attachmentNote;

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
        updateTurn(setTurns, assistantId, {
          content: response.text,
          providerName: response.providerName,
          elapsedMs: response.elapsedMs,
          ragUsed,
          webContext: web.badge,
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

  return { turns, isLoading, sendMessage, stopGeneration, clearChat };
}

export type { Attachment };
