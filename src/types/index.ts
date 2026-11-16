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
  autoRotate: boolean;
  manualProviderId: string;
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
  content: string | Array<ChatContentPart>;
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string };

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

export type FileFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'pptx' | 'csv' | 'image';

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

// ---------------------------------------------------------------------------
// Workspace Backup (Phase 9)
// ---------------------------------------------------------------------------

export interface PersistedChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  providerName?: string;
  elapsedMs?: number;
  ragUsed?: boolean;
  error?: string;
}

export interface PersistedConversation {
  id: string;
  title: string;
  turns: PersistedChatTurn[];
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotPersonas {
  custom: SystemPersona[];
  builtin: SystemPersona[];
}

export interface SnapshotProviders {
  /** Providers with API keys stripped. */
  safe: ProviderConfig[];
  /** Providers including API keys — only present when the user opts in. */
  withKeys?: ProviderConfig[];
}

export type WorkspaceSnapshotFormat = 'plain' | 'encrypted';

export interface WorkspaceSnapshotHeader {
  app: 'omnifree-ai-studio';
  kind: 'workspace-snapshot';
  schemaVersion: number;
  format: WorkspaceSnapshotFormat;
  createdAt: number;
}

export interface WorkspaceSnapshotData {
  schemaVersion: number;
  conversations: PersistedConversation[];
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
  personas: SnapshotPersonas;
  prompts: PromptSnippet[];
  providers: SnapshotProviders;
  settings?: AppSettings;
}

/** Plain JSON snapshot written to disk (data section present unencrypted). */
export interface WorkspaceSnapshotFile extends WorkspaceSnapshotHeader {
  format: 'plain';
  data: WorkspaceSnapshotData;
}

/** Encrypted snapshot — data is an opaque base64 payload (AES-GCM). */
export interface EncryptedWorkspaceSnapshotFile extends WorkspaceSnapshotHeader {
  format: 'encrypted';
  salt: string;
  iv: string;
  data: string;
}

export type WorkspaceSnapshot = WorkspaceSnapshotFile | EncryptedWorkspaceSnapshotFile;

export type RestoreMode = 'merge' | 'overwrite';

export interface RestoreSummary {
  conversationsAdded: number;
  documentsAdded: number;
  chunksAdded: number;
  personasAdded: number;
  promptsAdded: number;
  providersAdded: number;
  providersUpdated: number;
}

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
}
