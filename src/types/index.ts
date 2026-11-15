// ============================================================================
// OmniFree AI Studio — Shared Type Definitions
// ============================================================================

export type Language = 'en' | 'ar';

export type Direction = 'ltr' | 'rtl';

export interface AppSettings {
  language: Language;
  activeProviderId: string;
  activePersonaId: string;
  theme: 'light' | 'dark';
}

// ---------------------------------------------------------------------------
// Provider System (Phase 6)
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  priority: number;
}

export type ProviderRole = 'primary' | 'fallback';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderResponse {
  text: string;
  providerId: string;
  providerName: string;
  model: string;
  elapsedMs: number;
}

export interface ProviderError {
  providerId: string;
  providerName: string;
  message: string;
  status?: number;
}

// ---------------------------------------------------------------------------
// Prompt Library & Personas (Phase 7)
// ---------------------------------------------------------------------------

export interface SystemPersona {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon: string;
  isBuiltin: boolean;
}

export interface PromptSnippet {
  id: string;
  title: string;
  body: string;
  category: string;
}

// ---------------------------------------------------------------------------
// Document Analysis — RAG Lite (Phase 8)
// ---------------------------------------------------------------------------

export type DocumentStatus = 'processing' | 'ready' | 'error';

export type FileFormat = 'pdf' | 'docx' | 'txt' | 'md';

export interface DocumentChunk {
  id: string;
  documentId: string;
  index: number;
  text: string;
  wordCount: number;
  isRtl: boolean;
}

export interface DocumentRecord {
  id: string;
  name: string;
  format: FileFormat;
  sizeBytes: number;
  chunkCount: number;
  status: DocumentStatus;
  errorMessage?: string;
  enabled: boolean;
  uploadedAt: number;
}

export interface SearchResult {
  chunk: DocumentChunk;
  documentName: string;
  score: number;
}

export interface RagContext {
  snippets: string[];
  hasContext: boolean;
}
