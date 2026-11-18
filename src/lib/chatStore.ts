// ============================================================================
// chatStore — IndexedDB persistent storage for conversations (Phase 9)
// ============================================================================

import type { PersistedConversation } from '@/types';

const DB_NAME = 'omnifree-chat';
const DB_VERSION = 1;
const CONVO_STORE = 'conversations';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONVO_STORE)) {
        db.createObjectStore(CONVO_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function getAllConversations(): Promise<PersistedConversation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONVO_STORE, 'readonly');
    const request = transaction.objectStore(CONVO_STORE).getAll();
    request.onsuccess = () => resolve(request.result as PersistedConversation[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveConversation(convo: PersistedConversation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONVO_STORE, 'readwrite');
    transaction.objectStore(CONVO_STORE).put(convo);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveConversations(convos: PersistedConversation[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONVO_STORE, 'readwrite');
    const store = transaction.objectStore(CONVO_STORE);
    for (const convo of convos) {
      store.put(convo);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONVO_STORE, 'readwrite');
    transaction.objectStore(CONVO_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAllConversations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONVO_STORE, 'readwrite');
    transaction.objectStore(CONVO_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
