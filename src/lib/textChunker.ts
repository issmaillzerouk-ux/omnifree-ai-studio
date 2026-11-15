// ============================================================================
// textChunker — RTL-aware text segmentation
// Phase 8: Local File & Document Analyzer
// ============================================================================

import type { DocumentChunk } from '@/types';
import { generateId } from './documentStore';

const TARGET_CHUNK_WORDS = 200;
const OVERLAP_WORDS = 30;
const MIN_CHUNK_WORDS = 20;

/**
 * Detects whether a text segment is predominantly RTL (Arabic/Hebrew).
 */
export function detectRtl(text: string): boolean {
  const rtlChars = text.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const ltrChars = text.match(/[A-Za-z]/g);
  const rtlCount = rtlChars ? rtlChars.length : 0;
  const ltrCount = ltrChars ? ltrChars.length : 0;
  return rtlCount > ltrCount;
}

/**
 * Normalizes extracted text: collapses whitespace, preserves RTL characters.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0\u2000-\u200B\u202F\u205F\u3000]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits text into paragraphs, then groups paragraphs into chunks of ~200 words
 * with 30-word overlap. RTL flag is computed per chunk.
 */
export function chunkText(
  text: string,
  documentId: string,
): DocumentChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const chunks: DocumentChunk[] = [];
  let currentParagraphs: string[] = [];
  let currentWordCount = 0;
  let chunkIndex = 0;

  function flushChunk(): void {
    if (currentParagraphs.length === 0) return;
    const chunkTextStr = currentParagraphs.join('\n\n').trim();
    if (!chunkTextStr) {
      currentParagraphs = [];
      currentWordCount = 0;
      return;
    }
    const words = chunkTextStr.split(/\s+/);
    const wc = words.length;
    if (wc < MIN_CHUNK_WORDS && chunks.length > 0 && paragraphs.length > chunkIndex) {
      // Merge with previous chunk if too small
      const prev = chunks[chunks.length - 1];
      prev.text += '\n\n' + chunkTextStr;
      prev.wordCount += wc;
      prev.isRtl = detectRtl(prev.text);
      currentParagraphs = [];
      currentWordCount = 0;
      return;
    }
    chunks.push({
      id: generateId(),
      documentId,
      index: chunkIndex,
      text: chunkTextStr,
      wordCount: wc,
      isRtl: detectRtl(chunkTextStr),
    });
    chunkIndex++;
    currentParagraphs = [];
    currentWordCount = 0;
  }

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).length;
    if (currentWordCount + paraWords > TARGET_CHUNK_WORDS && currentWordCount > 0) {
      // Add overlap from end of current chunk
      const lastWords = currentParagraphs.join('\n\n').split(/\s+/).slice(-OVERLAP_WORDS).join(' ');
      flushChunk();
      if (lastWords) {
        currentParagraphs.push(lastWords);
        currentWordCount = lastWords.split(/\s+/).length;
      }
    }
    currentParagraphs.push(para.trim());
    currentWordCount += paraWords;
    if (currentWordCount >= TARGET_CHUNK_WORDS) {
      flushChunk();
    }
  }
  flushChunk();

  return chunks;
}
