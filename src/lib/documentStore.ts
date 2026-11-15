// ============================================================================
// documentStore — IndexedDB persistent storage for RAG Lite
// Phase 8: Local File & Document Analyzer
// ============================================================================

import type { DocumentRecord, DocumentChunk } from '@/types';

const DB_NAME = 'omnifree-rag';
const DB_VERSION = 1;
const DOC_STORE = 'documents';
const CHUNK_STORE = 'chunks';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
        store.createIndex('documentId', 'documentId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = fn(store);
    if (result instanceof Promise) {
      result.then(resolve).catch(reject);
    } else {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    }
  });
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function saveDocument(doc: DocumentRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readwrite');
    transaction.objectStore(DOC_STORE).put(doc);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllDocuments(): Promise<DocumentRecord[]> {
  return tx<DocumentRecord[]>(DOC_STORE, 'readonly', (store) =>
    store.getAll() as IDBRequest<DocumentRecord[]>,
  );
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readwrite');
    transaction.objectStore(DOC_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  await deleteChunksByDocument(id);
}

export async function updateDocument(
  id: string,
  updates: Partial<DocumentRecord>,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readwrite');
    const store = transaction.objectStore(DOC_STORE);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as DocumentRecord | undefined;
      if (!existing) {
        reject(new Error('Document not found'));
        return;
      }
      store.put({ ...existing, ...updates });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------------------------------------------------------------------------
// Chunks
// ---------------------------------------------------------------------------

export async function saveChunks(chunks: DocumentChunk[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, 'readwrite');
    const store = transaction.objectStore(CHUNK_STORE);
    for (const chunk of chunks) {
      store.put(chunk);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, 'readonly');
    const store = transaction.objectStore(CHUNK_STORE);
    const index = store.index('documentId');
    const request = index.getAll(documentId);
    request.onsuccess = () => resolve(request.result as DocumentChunk[]);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteChunksByDocument(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, 'readwrite');
    const store = transaction.objectStore(CHUNK_STORE);
    const index = store.index('documentId');
    const cursorRequest = index.openCursor(documentId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllChunks(): Promise<DocumentChunk[]> {
  return tx<DocumentChunk[]>(CHUNK_STORE, 'readonly', (store) =>
    store.getAll() as IDBRequest<DocumentChunk[]>,
  );
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function clearAllDocuments(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOC_STORE, CHUNK_STORE], 'readwrite');
    transaction.objectStore(DOC_STORE).clear();
    transaction.objectStore(CHUNK_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
