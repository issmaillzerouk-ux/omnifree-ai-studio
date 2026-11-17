// ============================================================================
// apiKeyStore — IndexedDB persistence for the self-healing router (Phase 10A)
// Stores: model caches, dead models, provider cooldowns, sync meta, logs
// ============================================================================

const DB_NAME = 'omnifree-router';
const DB_VERSION = 1;
const META_STORE = 'meta';
const MODELS_STORE = 'models';
const DEAD_STORE = 'deadModels';
const COOLDOWN_STORE = 'cooldowns';
const LOG_STORE = 'logs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [META_STORE, MODELS_STORE, DEAD_STORE, COOLDOWN_STORE, LOG_STORE]) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

interface IdRecord {
  id: string;
}

async function put<T extends IdRecord>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function get<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function del(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------------------------------------------------------------------------
// Sync meta
// ---------------------------------------------------------------------------

export interface SyncMeta {
  id: 'sync';
  lastSyncedAt: number;
}

export async function getSyncMeta(): Promise<SyncMeta> {
  const meta = await get<SyncMeta>(META_STORE, 'sync');
  return meta ?? { id: 'sync', lastSyncedAt: 0 };
}

export async function setSyncMeta(lastSyncedAt: number): Promise<void> {
  await put<SyncMeta>(META_STORE, { id: 'sync', lastSyncedAt });
}

// ---------------------------------------------------------------------------
// Live model cache — last successful /models response per provider
// ---------------------------------------------------------------------------

export interface ProviderModelCache {
  id: string; // provider id
  models: string[];
  updatedAt: number;
}

export async function getModelCache(providerId: string): Promise<ProviderModelCache | undefined> {
  return get<ProviderModelCache>(MODELS_STORE, providerId);
}

export async function putModelCache(providerId: string, models: string[]): Promise<void> {
  await put<ProviderModelCache>(MODELS_STORE, { id: providerId, models, updatedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Dead models — retired model IDs that returned HTTP 404
// ---------------------------------------------------------------------------

export interface DeadModelRecord {
  id: string; // `${providerId}:${model}`
  providerId: string;
  model: string;
  reason: string;
  at: number;
}

function deadId(providerId: string, model: string): string {
  return `${providerId}:${model}`;
}

export async function markModelDead(providerId: string, model: string, reason: string): Promise<void> {
  await put<DeadModelRecord>(DEAD_STORE, {
    id: deadId(providerId, model),
    providerId,
    model,
    reason,
    at: Date.now(),
  });
}

export async function isModelDead(providerId: string, model: string): Promise<boolean> {
  const record = await get<DeadModelRecord>(DEAD_STORE, deadId(providerId, model));
  return record !== undefined;
}

export async function getDeadModels(): Promise<DeadModelRecord[]> {
  return getAll<DeadModelRecord>(DEAD_STORE);
}

// ---------------------------------------------------------------------------
// Provider cooldowns — timed circuit-breaker state
// ---------------------------------------------------------------------------

export interface CooldownRecord {
  id: string; // provider id
  cooldownUntil: number;
  reason: string;
}

export async function setCooldown(providerId: string, until: number, reason: string): Promise<void> {
  await put<CooldownRecord>(COOLDOWN_STORE, { id: providerId, cooldownUntil: until, reason });
}

export async function clearCooldown(providerId: string): Promise<void> {
  await del(COOLDOWN_STORE, providerId);
}

export async function getCooldown(providerId: string): Promise<CooldownRecord | undefined> {
  const record = await get<CooldownRecord>(COOLDOWN_STORE, providerId);
  if (record && record.cooldownUntil <= Date.now()) {
    await clearCooldown(providerId);
    return undefined;
  }
  return record;
}

// ---------------------------------------------------------------------------
// Diagnostic logs — prune / repair / cooldown / sync events
// ---------------------------------------------------------------------------

export type RouterLogKind = 'sync' | 'prune' | 'repair' | 'cooldown';

export interface RouterLogEntry {
  id: string;
  kind: RouterLogKind;
  message: string;
  at: number;
}

const MAX_LOGS = 100;

export async function addLog(kind: RouterLogKind, message: string): Promise<RouterLogEntry> {
  const entry: RouterLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    message,
    at: Date.now(),
  };
  await put<RouterLogEntry>(LOG_STORE, entry);
  const all = await getAll<RouterLogEntry>(LOG_STORE);
  if (all.length > MAX_LOGS) {
    const oldest = all.sort((a, b) => a.at - b.at).slice(0, all.length - MAX_LOGS);
    for (const stale of oldest) {
      await del(LOG_STORE, stale.id);
    }
  }
  return entry;
}

export async function getRecentLogs(limit = 10): Promise<RouterLogEntry[]> {
  const all = await getAll<RouterLogEntry>(LOG_STORE);
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}
