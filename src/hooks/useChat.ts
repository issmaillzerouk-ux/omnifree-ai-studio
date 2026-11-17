// ============================================================================
// useChat — Chat hook with RAG context injection (Phase 8)
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatContentPart, ProviderResponse, ProviderConfig, SystemPersona, RagContext } from '@/types';
import { sendChatWithFallback } from '@/lib/router';
import { retrieveContext, buildRagContextString } from '@/lib/retrieval';
import { generateId } from '@/lib/documentStore';
import { saveConversation } from '@/lib/chatStore';
import type { PersistedConversation } from '@/types';

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
}

export interface Attachment {
  id: string;
  name: string;
  kind: 'text' | 'image';
  /** Extracted text content for text-like files. */
  text?: string;
  /** Base64 data URL for images (vision). */
  dataUrl?: string;
}

export interface UseChatOptions {
  providers: ProviderConfig[];
  persona: SystemPersona;
  autoRotate: boolean;
  manualProviderId?: string;
}

export function useChat({ providers, persona, autoRotate, manualProviderId }: UseChatOptions) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const convoIdRef = useRef<string>(generateId());

  // Autosave the active conversation whenever turns settle (Phase 9)
  useEffect(() => {
    const finished = turns.filter((t) => !t.pending);
    if (finished.length === 0) return;
    const existing = localStorage.getItem(CONVO_STORAGE_KEY);
    let convo: PersistedConversation;
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as PersistedConversation;
        if (parsed.id === convoIdRef.current) {
          convo = parsed;
        } else {
          convo = { id: convoIdRef.current, title: '', turns: [], createdAt: Date.now(), updatedAt: Date.now() };
        }
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

  const sendMessage = useCallback(
    async (userText: string, attachments: Attachment[] = []): Promise<void> => {
      if (isLoading) return;
      if (!userText.trim() && attachments.length === 0) return;
      setIsLoading(true);

      // RAG retrieval
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

      const attachmentNote = attachments.length > 0
        ? `\n\n${attachments
            .map((a) => (a.kind === 'text' ? `--- ${a.name} ---\n${a.text ?? ''}` : `[image: ${a.name}]`))
            .join('\n\n')}`
        : '';
      const displayText = userText || attachments.map((a) => a.name).join(', ');

      const userTurn: ChatTurn = {
        id: `${Date.now()}-u`,
        role: 'user',
        content: displayText + (attachments.some((a) => a.kind === 'image') ? ` [${t.imageAttached}]` : ''),
      };
      setTurns((prev) => [...prev, userTurn]);

      // Build message array
      const systemContent = ragContext
        ? `${persona.systemPrompt}\n\n${ragContext}`
        : persona.systemPrompt;

      // Attachments become part of the final user message content
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

      const controller = new AbortController();
      abortRef.current = controller;

      const assistantTurn: ChatTurn = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: '',
        pending: true,
        ragUsed,
      };
      setTurns((prev) => [...prev, assistantTurn]);

      try {
        const response: ProviderResponse = await sendChatWithFallback(
          providers,
          messages,
          controller.signal,
          {
            manualProviderId: autoRotate ? undefined : manualProviderId,
          },
        );
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantTurn.id
              ? {
                  ...t,
                  content: response.text,
                  providerName: response.providerName,
                  elapsedMs: response.elapsedMs,
                  pending: false,
                }
              : t,
          ),
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to get response';
        const isObj = typeof err === 'object' && err !== null && 'message' in err;
        const msg = isObj ? (err as { message: string }).message : errMsg;
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantTurn.id
              ? { ...t, content: '', error: msg, pending: false }
              : t,
          ),
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [turns, providers, persona, isLoading, autoRotate, manualProviderId],
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
