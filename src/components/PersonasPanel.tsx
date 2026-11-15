// ============================================================================
// PersonasPanel — System personas management (Phase 7)
// ============================================================================

import { Plus, Trash2, Check } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { SystemPersona } from '@/types';

interface PersonasPanelProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  personas: SystemPersona[];
  activePersonaId: string;
  onSelect: (id: string) => void;
  onAdd: (persona: SystemPersona) => void;
  onRemove: (id: string) => void;
}

export function PersonasPanel({ t, dir, personas, activePersonaId, onSelect, onAdd, onRemove }: PersonasPanelProps) {
  const handleAdd = () => {
    const newPersona: SystemPersona = {
      id: `custom-${Date.now()}`,
      name: 'New Persona',
      description: 'A custom persona.',
      systemPrompt: 'You are a helpful AI assistant.',
      icon: 'Sparkles',
      isBuiltin: false,
    };
    onAdd(newPersona);
  };

  return (
    <div dir={dir} className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.personas}</h2>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.addPersona}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {personas.map((persona) => {
          const isActive = persona.id === activePersonaId;
          return (
            <div
              key={persona.id}
              className={`
                rounded-xl border p-4 transition-all cursor-pointer
                ${isActive
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30 ring-1 ring-primary-400'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600'
                }
              `}
              onClick={() => onSelect(persona.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isActive && <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                    <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{persona.name}</h3>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{persona.description}</p>
                </div>
                {!persona.isBuiltin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(persona.id);
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 line-clamp-2">{persona.systemPrompt}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
