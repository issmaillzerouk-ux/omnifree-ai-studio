// ============================================================================
// useProviders — Provider management hook (Phase 6)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { ProviderConfig } from '@/types';
import { loadProviders, saveProviders } from '@/lib/providers';

export function useProviders() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);

  useEffect(() => {
    setProviders(loadProviders());
  }, []);

  const update = useCallback((id: string, updates: Partial<ProviderConfig>) => {
    setProviders((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      saveProviders(next);
      return next;
    });
  }, []);

  const add = useCallback((provider: ProviderConfig) => {
    setProviders((prev) => {
      const next = [...prev, provider];
      saveProviders(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setProviders((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProviders(next);
      return next;
    });
  }, []);

  const activeId = providers.find((p) => p.enabled && p.apiKey.trim())?.id ?? '';

  return { providers, update, add, remove, activeId };
}
