// ============================================================================
// fileParsers — PDF / DOCX / TXT / MD extraction with memory cleanup
// Phase 8: Local File & Document Analyzer
// ============================================================================

import type { FileFormat } from '@/types';

export interface ParseResult {
  text: string;
  format: FileFormat;
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export function detectFormat(fileName: string): FileFormat | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  return null;
}

// ---------------------------------------------------------------------------
// PDF parsing via pdfjs-dist
// ---------------------------------------------------------------------------

export async function parsePdf(file: File): Promise<ParseResult> {
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
// TXT / MD parsing
// ---------------------------------------------------------------------------

export async function parseTxt(file: File): Promise<ParseResult> {
  try {
    const text = await file.text();
    const format: FileFormat = file.name.toLowerCase().endsWith('.md') ? 'md' : 'txt';
    return { text, format };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseErrorImpl(`Failed to read text file: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main entry point with cleanup
// ---------------------------------------------------------------------------

export async function parseFile(file: File): Promise<ParseResult> {
  const format = detectFormat(file.name);
  if (!format) {
    throw new ParseErrorImpl('Unsupported file format. Please upload PDF, DOCX, TXT, or MD files.');
  }

  const maxSize = 20 * 1024 * 1024; // 20MB limit
  if (file.size > maxSize) {
    throw new ParseErrorImpl('File is too large (max 20MB).');
  }

  try {
    switch (format) {
      case 'pdf':
        return await parsePdf(file);
      case 'docx':
        return await parseDocx(file);
      case 'txt':
      case 'md':
        return await parseTxt(file);
    }
  } catch (err) {
    if (err instanceof ParseErrorImpl) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ParseErrorImpl(`Failed to parse file: ${msg}`);
  }
  throw new ParseErrorImpl('Unknown error');
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


export { detectFormat }