// ============================================================================
// FileUploader — Drag & Drop file ingestion (Phase 8)
// Bilingual RTL/LTR aware, matches application design system
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { CloudUpload as UploadCloud, FileText, Loader as Loader2, CircleAlert as AlertCircle, X } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import { detectFormat } from '@/lib/fileParsers';

interface FileUploaderProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  onFile: (file: File) => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function FileUploader({ t, dir, onFile, isLoading, error, onClearError }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const format = detectFormat(file.name);
      if (format) onFile(file);
    }
  }, [onFile, isLoading]);

  const handleBrowse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFile(e.target.files[0]);
      e.target.value = '';
    }
  }, [onFile]);

  return (
    <div dir={dir} className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleBrowse();
        }}
        className={`
          relative flex flex-col items-center justify-center gap-3
          rounded-2xl border-2 border-dashed p-8 text-center
          transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 scale-[1.01]'
            : 'border-neutral-300 dark:border-neutral-700 hover:border-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
          }
          ${isLoading ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        {isLoading ? (
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        ) : (
          <UploadCloud className={`w-10 h-10 transition-colors ${isDragging ? 'text-primary-500' : 'text-neutral-400'}`} />
        )}
        <div className="space-y-1">
          <p className="font-semibold text-neutral-700 dark:text-neutral-200">
            {t.dragDropHere}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t.dragDropOr}{' '}
            <span className="text-primary-600 dark:text-primary-400 font-medium underline">
              {t.browse}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
          <FileText className="w-3.5 h-3.5" />
          <span>{t.supportedFormats}</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-error-700 dark:text-error-300 flex-1">{error}</p>
          <button
            onClick={onClearError}
            className="text-error-500 hover:text-error-700 dark:hover:text-error-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
