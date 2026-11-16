// ============================================================================
// Sidebar — Navigation between Chat, Knowledge, Providers, Personas, Prompts
// ============================================================================

import { MessageSquare, Database, Settings2, Users, BookMarked, Moon, Sun, Languages, HardDriveDownload } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { Language } from '@/types';

export type SidebarView = 'chat' | 'knowledge' | 'providers' | 'personas' | 'prompts' | 'backup';

interface SidebarProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  language: Language;
  onToggleLanguage: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const NAV_ITEMS: Array<{ view: SidebarView; icon: typeof MessageSquare; labelKey: keyof Translation }> = [
  { view: 'chat', icon: MessageSquare, labelKey: 'chat' },
  { view: 'knowledge', icon: Database, labelKey: 'knowledge' },
  { view: 'providers', icon: Settings2, labelKey: 'providers' },
  { view: 'personas', icon: Users, labelKey: 'personas' },
  { view: 'prompts', icon: BookMarked, labelKey: 'promptLibrary' },
  { view: 'backup', icon: HardDriveDownload, labelKey: 'dataBackup' },
];

export function Sidebar({ t, dir, activeView, onViewChange, language, onToggleLanguage, theme, onToggleTheme }: SidebarProps) {
  return (
    <aside dir={dir} className="w-16 lg:w-56 flex flex-col bg-neutral-900 dark:bg-black border-r border-neutral-800 flex-shrink-0">
      {/* Logo */}
      <div className="p-3 lg:p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-white text-sm font-semibold leading-tight">{t.appTitle}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onViewChange(item.view)}
              className={`
                w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all
                ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden lg:inline font-medium">{t[item.labelKey]}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className="p-2 border-t border-neutral-800 space-y-1">
        <button
          onClick={onToggleLanguage}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
        >
          <Languages className="w-4 h-4 flex-shrink-0" />
          <span className="hidden lg:inline font-medium uppercase">{language}</span>
        </button>
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          <span className="hidden lg:inline font-medium">{theme === 'dark' ? t.light : t.dark}</span>
        </button>
      </div>
    </aside>
  );
}
