// ============================================================================
// useSettings — Language, theme, active persona (Phases 1-7)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { Language, AppSettings } from '@/types';

const SETTINGS_KEY = 'omnifree-settings';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  activeProviderId: '',
  activePersonaId: 'general-assistant',
  theme: 'light',
  autoRotate: true,
  manualProviderId: '',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) as Partial<AppSettings> });
      }
    } catch {
      // fall through
    }
  }, []);

  const update = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      if (next.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang: Language = settings.language === 'en' ? 'ar' : 'en';
    update({ language: newLang });
  }, [settings.language, update]);

  return { settings, update, toggleLanguage };
}
