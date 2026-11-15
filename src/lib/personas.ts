// ============================================================================
// personas — System personas & prompt library (Phase 7)
// ============================================================================

import type { SystemPersona, PromptSnippet } from '@/types';

const PERSONAS_KEY = 'omnifree-personas';
const PROMPTS_KEY = 'omnifree-prompts';

const BUILTIN_PERSONAS: SystemPersona[] = [
  {
    id: 'general-assistant',
    name: 'General Assistant',
    description: 'A helpful, concise general-purpose AI assistant.',
    systemPrompt: 'You are a helpful, concise AI assistant. Answer clearly and accurately.',
    icon: 'Sparkles',
    isBuiltin: true,
  },
  {
    id: 'code-expert',
    name: 'Code Expert',
    description: 'An expert software engineer focused on clean code.',
    systemPrompt: 'You are an expert software engineer. Provide clean, well-structured code solutions with clear explanations.',
    icon: 'Code',
    isBuiltin: true,
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    description: 'Analyzes documents and synthesizes insights.',
    systemPrompt: 'You are a meticulous research analyst. When given document excerpts, synthesize insights, cite sources, and note when information is insufficient.',
    icon: 'Search',
    isBuiltin: true,
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    description: 'A creative writing companion for stories and content.',
    systemPrompt: 'You are a creative writing companion. Help craft engaging stories, articles, and creative content.',
    icon: 'PenTool',
    isBuiltin: true,
  },
];

export function loadPersonas(): SystemPersona[] {
  try {
    const stored = localStorage.getItem(PERSONAS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SystemPersona[];
      // Merge builtins with custom
      const custom = parsed.filter((p) => !p.isBuiltin);
      return [...BUILTIN_PERSONAS, ...custom];
    }
  } catch {
    // fall through
  }
  return [...BUILTIN_PERSONAS];
}

export function savePersonas(personas: SystemPersona[]): void {
  const custom = personas.filter((p) => !p.isBuiltin);
  localStorage.setItem(PERSONAS_KEY, JSON.stringify(custom));
}

export function getPersonaById(personas: SystemPersona[], id: string): SystemPersona {
  return personas.find((p) => p.id === id) ?? BUILTIN_PERSONAS[0];
}

const BUILTIN_PROMPTS: PromptSnippet[] = [
  { id: 'summarize', title: 'Summarize Document', body: 'Summarize the key points from the provided document excerpts in a concise bulleted list.', category: 'Analysis' },
  { id: 'extract-entities', title: 'Extract Entities', body: 'Extract all named entities (people, organizations, locations, dates) from the provided text and present them in a table.', category: 'Analysis' },
  { id: 'translate-ar', title: 'Translate to Arabic', body: 'Translate the following text into Modern Standard Arabic, preserving technical terms.', category: 'Translation' },
  { id: 'qa', title: 'Answer from Document', body: 'Based only on the provided document excerpts, answer the following question. If the answer is not in the excerpts, say so.', category: 'Analysis' },
  { id: 'outline', title: 'Create Outline', body: 'Create a structured outline of the main topics covered in the provided document.', category: 'Writing' },
];

export function loadPrompts(): PromptSnippet[] {
  try {
    const stored = localStorage.getItem(PROMPTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PromptSnippet[];
      return [...BUILTIN_PROMPTS, ...parsed];
    }
  } catch {
    // fall through
  }
  return [...BUILTIN_PROMPTS];
}

export function savePrompts(prompts: PromptSnippet[]): void {
  const custom = prompts.filter((p) => !BUILTIN_PROMPTS.some((b) => b.id === p.id));
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(custom));
}
