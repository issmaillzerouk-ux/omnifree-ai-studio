// ============================================================================
// fileParsers — PDF / DOCX / PPTX / TXT / MD / CSV extraction with memory
// cleanup, streaming progress and image handling (Phase 10)
// ============================================================================

import JSZip from 'jszip';
import type { FileFormat } from '@/types';

export interface ParseResult {
  text: string;
  format: FileFormat;
}

export type ParseProgress = (percent: number) => void;

const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250MB
const PDF_BATCH_SIZE = 10;
const IMAGE_COMPRESS_THRESHOLD = 4 * 1024 * 1024; // 4MB
const IMAGE_MAX_DIMENSION = 2048;

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

export function detectFormat(fileName: string): FileFormat | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  if (ext === 'ppt' || ext === 'pptx') return 'pptx';
  if (ext === 'csv') return 'csv';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return null;
}

// ---------------------------------------------------------------------------
// PDF parsing via pdfjs-dist — streaming, page-batched with progress
// ---------------------------------------------------------------------------

export async function parsePdf(file: File, onProgress?: ParseProgress): Promise<ParseResult> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new ParseErrorImpl('Could not read file data');
  }

  try {
    const pdfjs = await import('pdfjs-dist');
    const workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

    const uint8 = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjs.getDocument({
      data: uint8,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = pdf.numPages;
    onProgress?.(0);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          if ('str' in item && typeof item.str === 'string') return item.str;
          return '';
        })
        .join(' ');
      fullText += pageText + '\n\n';
      page.cleanup();

      if (i % PDF_BATCH_SIZE === 0 || i === maxPages) {
        onProgress?.(Math.round((i / maxPages) * 100));
        // Yield to the main thread so the UI stays responsive on huge PDFs
        await yieldToUI();
      }
    }
    await loadingTask.destroy();
    return { text: fullText, format: 'pdf' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
      throw new ParseErrorImpl('This PDF is password-protected', true);
    }
    throw new ParseErrorImpl(`Failed to parse PDF: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// DOCX parsing via mammoth
// ---------------------------------------------------------------------------

export async function parseDocx(file: File): Promise<ParseResult> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new ParseErrorImpl('Could not read file data');
  }

  try {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, format: 'docx' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseErrorImpl(`Failed to parse DOCX: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// PPTX parsing via jszip — slide-by-slide streaming extraction
// ---------------------------------------------------------------------------

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function parsePptx(file: File, onProgress?: ParseProgress): Promise<ParseResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const slidePaths = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10);
        return numA - numB;
      });

    if (slidePaths.length === 0) {
      throw new ParseErrorImpl('No slides found in this presentation');
    }

    const sections: string[] = [];
    onProgress?.(0);
    for (let i = 0; i < slidePaths.length; i++) {
      const xml = await zip.file(slidePaths[i])!.async('string');
      const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]));
      if (runs.length > 0) {
        sections.push(`[Slide ${i + 1}]\n${runs.join('\n')}`);
      }
      onProgress?.(Math.round(((i + 1) / slidePaths.length) * 100));
      // Release each slide's XML before reading the next — never hold the
      // whole uncompressed archive as one string
      await yieldToUI();
    }

    return { text: sections.join('\n\n'), format: 'pptx' };
  } catch (err: unknown) {
    if (err instanceof ParseErrorImpl) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseErrorImpl(`Failed to parse PPTX: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Image handling — downscale oversized images before Base64 encoding
// ---------------------------------------------------------------------------

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

async function downscaleImage(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = dataUrl;
  });

  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function parseImage(file: File): Promise<{ dataUrl: string }> {
  const dataUrl = await readAsDataUrl(file);
  if (file.size > IMAGE_COMPRESS_THRESHOLD) {
    return { dataUrl: await downscaleImage(dataUrl) };
  }
  return { dataUrl };
}

// ---------------------------------------------------------------------------
// TXT / MD / CSV parsing
// ---------------------------------------------------------------------------

export async function parseTxt(file: File): Promise<ParseResult> {
  try {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    const format: FileFormat = lower.endsWith('.md')
      ? 'md'
      : lower.endsWith('.csv')
        ? 'csv'
        : 'txt';
    return { text, format };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseErrorImpl(`Failed to read text file: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main entry point with cleanup
// ---------------------------------------------------------------------------

export async function parseFile(
  file: File,
  onProgress?: ParseProgress,
): Promise<ParseResult> {
  const format = detectFormat(file.name);
  if (!format || format === 'image') {
    throw new ParseErrorImpl(
      'Unsupported file format. Please upload PDF, DOCX, PPTX, TXT, MD, or CSV files.',
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ParseErrorImpl('File is too large (max 250MB).');
  }

  try {
    switch (format) {
      case 'pdf':
        return await parsePdf(file, onProgress);
      case 'docx':
        return await parseDocx(file);
      case 'pptx':
        return await parsePptx(file, onProgress);
      case 'txt':
      case 'md':
      case 'csv':
        return await parseTxt(file);
    }
  } catch (err) {
    if (err instanceof ParseErrorImpl) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseErrorImpl(`Failed to parse file: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ParseErrorImpl extends Error {
  public protected: boolean;
  constructor(message: string, isProtected = false) {
    super(message);
    this.name = 'ParseError';
    this.protected = isProtected;
  }
}
