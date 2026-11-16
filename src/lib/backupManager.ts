// ============================================================================
// backupManager — Workspace snapshot export/import (Phase 9)
// Streaming serialization, schema validation, merge/overwrite restore, rollback
// ============================================================================

import type {
  WorkspaceSnapshot,
  WorkspaceSnapshotFile,
  EncryptedWorkspaceSnapshotFile,
  WorkspaceSnapshotData,
  PersistedConversation,
  RestoreMode,
  RestoreSummary,
  ProviderConfig,
  SystemPersona,
  PromptSnippet,
  DocumentRecord,
  DocumentChunk,
  AppSettings,
} from '@/types';
import { getAllConversations, saveConversations, clearAllConversations } from '@/lib/chatStore';
import {
  getAllDocuments,
  getAllChunks,
  saveDocument,
  saveChunks,
  clearAllDocuments,
} from '@/lib/documentStore';
import { loadProviders, saveProviders } from '@/lib/providers';
import { loadPersonas, savePersonas, loadPrompts, savePrompts } from '@/lib/personas';

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
  snapshot?: WorkspaceSnapshotFile;
  encrypted?: EncryptedWorkspaceSnapshotFile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validate an unknown parsed backup file against the current schema. */
export function validateSnapshot(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return { valid: false, error: 'Not a JSON object' };
  if (raw['kind'] !== 'workspace-snapshot') {
    return { valid: false, error: 'Not an OmniFree AI Studio backup file' };
  }
  if (raw['app'] !== 'omnifree-ai-studio') {
    return { valid: false, error: 'Backup from an unknown application' };
  }
  const version = raw['schemaVersion'];
  if (typeof version !== 'number') {
    return { valid: false, error: 'Missing schema version' };
  }
  if (version > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Backup version ${version} is newer than this app (v${SCHEMA_VERSION}). Update the app first.`,
    };
  }
  if (raw['format'] === 'encrypted') {
    if (typeof raw['data'] !== 'string' || typeof raw['salt'] !== 'string' || typeof raw['iv'] !== 'string') {
      return { valid: false, error: 'Encrypted backup is missing required fields' };
    }
    return {
      valid: true,
      encrypted: raw as unknown as EncryptedWorkspaceSnapshotFile,
    };
  }
  if (raw['format'] !== 'plain') {
    return { valid: false, error: 'Unknown snapshot format' };
  }
  const data = raw['data'];
  if (!isRecord(data)) return { valid: false, error: 'Snapshot data section is missing' };
  if (!Array.isArray(data['conversations'])) return { valid: false, error: 'Invalid conversations section' };
  if (!Array.isArray(data['documents'])) return { valid: false, error: 'Invalid documents section' };
  if (!Array.isArray(data['chunks'])) return { valid: false, error: 'Invalid chunks section' };
  if (!isRecord(data['personas']) || !Array.isArray(data['personas'].custom)) {
    return { valid: false, error: 'Invalid personas section' };
  }
  if (!Array.isArray(data['prompts'])) return { valid: false, error: 'Invalid prompts section' };
  if (!isRecord(data['providers']) || !Array.isArray(data['providers'].safe)) {
    return { valid: false, error: 'Invalid providers section' };
  }
  return { valid: true, snapshot: raw as unknown as WorkspaceSnapshotFile };
}

// ---------------------------------------------------------------------------
// Encryption (AES-GCM via WebCrypto)
// ---------------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 310000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSnapshotData(
  data: WorkspaceSnapshotData,
  password: string,
): Promise<Omit<EncryptedWorkspaceSnapshotFile, 'app' | 'kind' | 'schemaVersion' | 'createdAt'>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource,
  );
  return {
    format: 'encrypted',
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  };
}

export async function decryptSnapshot(
  file: EncryptedWorkspaceSnapshotFile,
  password: string,
): Promise<WorkspaceSnapshotData> {
  const salt = fromBase64(file.salt);
  const iv = fromBase64(file.iv);
  const key = await deriveKey(password, salt);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      fromBase64(file.data) as unknown as BufferSource,
    );
  } catch {
    throw new Error('Wrong password or corrupted backup');
  }
  return JSON.parse(new TextDecoder().decode(decrypted)) as WorkspaceSnapshotData;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportOptions {
  includeApiKeys: boolean;
  password?: string;
}

export async function createSnapshot(options: ExportOptions): Promise<WorkspaceSnapshot> {
  const [conversations, documents, chunks] = await Promise.all([
    getAllConversations(),
    getAllDocuments(),
    getAllChunks(),
  ]);

  const providers = loadProviders();
  const safeProviders = providers.map((p) => ({ ...p, apiKey: '' }));
  const snapshotData: WorkspaceSnapshotData = {
    schemaVersion: SCHEMA_VERSION,
    conversations,
    documents,
    chunks,
    personas: {
      custom: loadPersonas().filter((p) => !p.isBuiltin),
      builtin: [],
    },
    prompts: loadPrompts(),
    providers: options.includeApiKeys
      ? { safe: safeProviders, withKeys: providers }
      : { safe: safeProviders },
  };

  const header = {
    app: 'omnifree-ai-studio' as const,
    kind: 'workspace-snapshot' as const,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
  };

  if (options.password && options.password.length > 0) {
    const encrypted = await encryptSnapshotData(snapshotData, options.password);
    return { ...header, ...encrypted };
  }
  return { ...header, format: 'plain', data: snapshotData };
}

// ---------------------------------------------------------------------------
// Import — merge / overwrite with rollback
// ---------------------------------------------------------------------------

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): { items: T[]; added: number } {
  const seen = new Set(existing.map((item) => item.id));
  const additions = incoming.filter((item) => !seen.has(item.id));
  return { items: [...existing, ...additions], added: additions.length };
}

export async function restoreSnapshot(
  data: WorkspaceSnapshotData,
  mode: RestoreMode,
): Promise<RestoreSummary> {
  // Pre-restore safety check: capture current state for rollback
  const rollback = {
    conversations: await getAllConversations(),
    documents: await getAllDocuments(),
    chunks: await getAllChunks(),
    providers: loadProviders(),
    personas: loadPersonas().filter((p) => !p.isBuiltin),
    prompts: loadPrompts(),
  };

  const docIds = new Set(rollback.documents.map((d) => d.id));
  const chunkIds = new Set(rollback.chunks.map((c) => c.id));
  const convoIds = new Set(rollback.conversations.map((c) => c.id));
  const personaIds = new Set(rollback.personas.map((p) => p.id));
  const promptIds = new Set(rollback.prompts.map((p) => p.id));
  const providerIds = new Set(rollback.providers.map((p) => p.id));

  const incomingConversations = data.conversations.filter((c) => !convoIds.has(c.id));
  const incomingDocuments = data.documents.filter((d) => !docIds.has(d.id));
  const incomingChunks = data.chunks.filter((c) => !chunkIds.has(c.id));
  const incomingPersonas = data.personas.custom.filter((p) => !personaIds.has(p.id));
  const incomingPrompts = data.prompts.filter((p) => !promptIds.has(p.id));

  try {
    if (mode === 'overwrite') {
      await clearAllConversations();
      await clearAllDocuments();
      await saveConversations(data.conversations);
      for (const doc of data.documents) {
        await saveDocument(doc);
      }
      await saveChunks(data.chunks);
      saveProviders(data.providers.withKeys ?? data.providers.safe);
      const customPersonas = data.personas.custom;
      if (customPersonas.length > 0) savePersonas(customPersonas);
      savePrompts(data.prompts);
      return {
        conversationsAdded: data.conversations.length,
        documentsAdded: data.documents.length,
        chunksAdded: data.chunks.length,
        personasAdded: customPersonas.length,
        promptsAdded: data.prompts.length,
        providersAdded: (data.providers.withKeys ?? data.providers.safe).length,
        providersUpdated: 0,
      };
    }

    // Merge mode — append non-duplicates by unique ID
    const mergedConversations: PersistedConversation[] = [
      ...rollback.conversations,
      ...incomingConversations,
    ];
    await saveConversations(incomingConversations);

    for (const doc of incomingDocuments) {
      await saveDocument(doc);
    }
    await saveChunks(incomingChunks);

    const existingCustomPersonas: SystemPersona[] = rollback.personas;
    const mergedPersonas = mergeById(existingCustomPersonas, incomingPersonas);
    if (incomingPersonas.length > 0) savePersonas(mergedPersonas.items);

    const mergedPrompts = mergeById(rollback.prompts, incomingPrompts);
    if (incomingPrompts.length > 0) savePrompts(mergedPrompts.items);

    // Providers: fill missing keys from backup, keep local overrides
    let providersUpdated = 0;
    let providersAdded = 0;
    const incomingProviders: ProviderConfig[] = data.providers.withKeys ?? data.providers.safe;
    const mergedProviders: ProviderConfig[] = rollback.providers.map((local) => {
      const match = incomingProviders.find((p) => p.id === local.id);
      if (match && !local.apiKey.trim() && match.apiKey.trim()) {
        providersUpdated += 1;
        return { ...local, apiKey: match.apiKey };
      }
      return local;
    });
    for (const provider of incomingProviders) {
      if (!providerIds.has(provider.id)) {
        mergedProviders.push(provider);
        providersAdded += 1;
      }
    }
    saveProviders(mergedProviders);

    return {
      conversationsAdded: incomingConversations.length,
      documentsAdded: incomingDocuments.length,
      chunksAdded: incomingChunks.length,
      personasAdded: incomingPersonas.length,
      promptsAdded: incomingPrompts.length,
      providersAdded,
      providersUpdated,
    };
  } catch (err) {
    // Rollback on mid-transaction failure
    await saveConversations(rollback.conversations);
    await clearAllDocuments();
    for (const doc of rollback.documents) {
      await saveDocument(doc);
    }
    await saveChunks(rollback.chunks);
    saveProviders(rollback.providers);
    savePersonas(rollback.personas);
    savePrompts(rollback.prompts);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Import failed and was rolled back: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Storage estimate
// ---------------------------------------------------------------------------

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === 'object' && navigator.storage && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  }
  return { usage: 0, quota: 0 };
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

export function downloadSnapshot(snapshot: WorkspaceSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `omnifree-backup-${stamp}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
