// ============================================================================
// retrieval — Local BM25-style keyword search for RAG Lite
// Phase 8: Local File & Document Analyzer
// ============================================================================

import type { DocumentChunk, DocumentRecord, SearchResult } from '@/types';
import { getAllChunks, getAllDocuments } from './documentStore';

const MAX_RESULTS = 6;
const BM25_K1 = 1.5;
const BM25_B = 0.75;

interface ChunkMetadata {
  chunk: DocumentChunk;
  terms: string[];
  length: number;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// ---------------------------------------------------------------------------
// BM25 scoring
// ---------------------------------------------------------------------------

export function searchChunks(
  query: string,
  chunks: DocumentChunk[],
  maxResults = MAX_RESULTS,
): SearchResult[] {
  if (chunks.length === 0) return [];
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // Build metadata
  const metadata: ChunkMetadata[] = chunks.map((chunk) => ({
    chunk,
    terms: tokenize(chunk.text),
    length: 0,
  }));
  metadata.forEach((m) => {
    m.length = m.terms.length;
  });

  const avgLength = metadata.reduce((sum, m) => sum + m.length, 0) / metadata.length;
  if (avgLength === 0) return [];

  // Document frequency per term
  const df = new Map<string, number>();
  for (const m of metadata) {
    const seen = new Set<string>();
    for (const term of m.terms) {
      if (!seen.has(term)) {
        seen.add(term);
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
  }

  const N = metadata.length;
  const scores: SearchResult[] = [];

  for (const m of metadata) {
    const tf = new Map<string, number>();
    for (const term of m.terms) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }

    let score = 0;
    for (const qt of queryTerms) {
      const termFreq = tf.get(qt);
      if (!termFreq) continue;
      const docFreq = df.get(qt) ?? 0;
      const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
      const norm = 1 - BM25_B + BM25_B * (m.length / avgLength);
      score += (idf * (termFreq * (BM25_K1 + 1))) / (termFreq + BM25_K1 * norm);
    }

    if (score > 0) {
      scores.push({
        chunk: m.chunk,
        documentName: '',
        score,
      });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Full retrieval pipeline (queries IndexedDB, filters by enabled docs)
// ---------------------------------------------------------------------------

export async function retrieveContext(query: string): Promise<SearchResult[]> {
  const [allDocs, allChunks] = await Promise.all([
    getAllDocuments(),
    getAllChunks(),
  ]);

  const enabledDocIds = new Set(
    allDocs.filter((d) => d.enabled && d.status === 'ready').map((d) => d.id),
  );
  if (enabledDocIds.size === 0) return [];

  const filteredChunks = allChunks.filter((c) => enabledDocIds.has(c.documentId));
  if (filteredChunks.length === 0) return [];

  const docNameMap = new Map(allDocs.map((d) => [d.id, d.name]));
  const results = searchChunks(query, filteredChunks);
  return results.map((r) => ({
    ...r,
    documentName: docNameMap.get(r.chunk.documentId) ?? 'Unknown',
  }));
}

/**
 * Builds a RAG context string for injection into the system prompt.
 */
export function buildRagContextString(results: SearchResult[]): string {
  if (results.length === 0) return '';
  const snippets = results.map((r, i) => {
    const source = r.documentName;
    const dirAttr = r.chunk.isRtl ? 'rtl' : 'ltr';
    const truncated = r.chunk.text.length > 800 ? r.chunk.text.slice(0, 800) + '…' : r.chunk.text;
    return `[${i + 1}] Source: ${source}\n(dir=${dirAttr})\n${truncated}`;
  });
  return [
    'The following relevant excerpts were retrieved from locally uploaded documents. Use them to inform your response when relevant:',
    '',
    snippets.join('\n\n---\n\n'),
  ].join('\n');
}
