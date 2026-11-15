// ============================================================================
// useChat — Chat hook with RAG context injection (Phase 8)
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import type { ChatMessage, ProviderResponse, ProviderConfig, SystemPersona, RagContext } from '@/types';
import { sendChatWithFallback } from '@/lib/providers';
import { retrieveContext, buildRagContextString } from '@/lib/retrieval';

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

export interface UseChatOptions {
  providers: ProviderConfig[];
  persona: SystemPersona;
}

export function useChat({ providers, persona }: UseChatOptions) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userText: string): Promise<void> => {
      if (!userText.trim() || isLoading) return;
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

      const userTurn: ChatTurn = {
        id: `${Date.now()}-u`,
        role: 'user',
        content: userText,
      };
      setTurns((prev) => [...prev, userTurn]);

      // Build message array
      const systemContent = ragContext
        ? `${persona.systemPrompt}\n\n${ragContext}`
        : persona.systemPrompt;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemContent },
        ...turns.map((t): ChatMessage => ({ role: t.role, content: t.content })),
        { role: 'user', content: userText },
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
    [turns, providers, persona, isLoading],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = useCallback(() => {
    setTurns([]);
  }, []);

  return { turns, isLoading, sendMessage, stopGeneration, clearChat };
}
