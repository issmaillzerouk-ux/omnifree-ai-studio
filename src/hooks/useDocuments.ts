// ============================================================================
// useDocuments — Document management hook (Phase 8)
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { DocumentRecord, DocumentChunk } from '@/types';
import {
  getAllDocuments,
  saveDocument,
  saveChunks,
  deleteDocument,
  updateDocument,
  generateId,
} from '@/lib/documentStore';
import { parseFile, ParseErrorImpl } from '@/lib/fileParsers';
import { chunkText } from '@/lib/textChunker';

export interface UseDocumentsResult {
  documents: DocumentRecord[];
  isLoading: boolean;
  error: string | null;
  addFile: (file: File) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  toggleEnabled: (id: string) => Promise<void>;
  clearError: () => void;
  refresh: () => Promise<void>;
}

export function useDocuments(): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs.sort((a, b) => b.uploadedAt - a.uploadedAt));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load documents';
      setError(msg);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addFile = useCallback(async (file: File): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const docId = generateId();
    let doc: DocumentRecord = {
      id: docId,
      name: file.name,
      format: 'txt',
      sizeBytes: file.size,
      chunkCount: 0,
      status: 'processing',
      enabled: true,
      uploadedAt: Date.now(),
    };

    try {
      const result = await parseFile(file);
      doc.format = result.format;
      await saveDocument(doc);
      await refresh();

      const chunks: DocumentChunk[] = chunkText(result.text, docId);
      if (chunks.length === 0) {
        doc = { ...doc, status: 'error', errorMessage: 'No extractable text found' };
        await saveDocument(doc);
        await refresh();
        setError('No extractable text found in this file.');
        return;
      }

      await saveChunks(chunks);
      doc = {
        ...doc,
        chunkCount: chunks.length,
        status: 'ready',
        errorMessage: undefined,
      };
      await saveDocument(doc);
      await refresh();
    } catch (err: unknown) {
      const isProtected = err instanceof ParseErrorImpl && err.protected;
      const msg = err instanceof Error ? err.message : 'Failed to process file';
      doc = { ...doc, status: 'error', errorMessage: msg, enabled: !isProtected };
      await saveDocument(doc);
      await refresh();
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const removeDocument = useCallback(async (id: string): Promise<void> => {
    await deleteDocument(id);
    await refresh();
  }, [refresh]);

  const toggleEnabled = useCallback(async (id: string): Promise<void> => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;
    await updateDocument(id, { enabled: !doc.enabled });
    await refresh();
  }, [documents, refresh]);

  const clearError = useCallback(() => setError(null), []);

  return {
    documents,
    isLoading,
    error,
    addFile,
    removeDocument,
    toggleEnabled,
    clearError,
    refresh,
  };
}
