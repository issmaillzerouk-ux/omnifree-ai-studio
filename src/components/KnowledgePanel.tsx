// ============================================================================
// KnowledgePanel — Document management UI (Phase 8)
// Displays uploaded files, processing status, chunk counts, enable/disable toggles
// ============================================================================

import { FileText, Loader as Loader2, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Trash2, Database, Files, Layers } from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { DocumentRecord, DocumentStatus } from '@/types';
import { FileUploader } from './FileUploader';

interface KnowledgePanelProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  documents: DocumentRecord[];
  isLoading: boolean;
  error: string | null;
  onAddFile: (file: File) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onClearError: () => void;
}

function StatusBadge({ status, t }: { status: DocumentStatus; t: Translation }) {
  const config = {
    processing: { icon: Loader2, text: t.processing, cls: 'bg-warning-50 text-warning-700 dark:bg-warning-950/30 dark:text-warning-400', spin: true },
    ready: { icon: CheckCircle2, text: t.ready, cls: 'bg-success-50 text-success-700 dark:bg-success-950/30 dark:text-success-400', spin: false },
    error: { icon: AlertCircle, text: t.error, cls: 'bg-error-50 text-error-700 dark:bg-error-950/30 dark:text-error-400', spin: false },
  };
  const { icon: Icon, text, cls, spin } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon className={`w-3 h-3 ${spin ? 'animate-spin' : ''}`} />
      {text}
    </span>
  );
}

function ToggleSwitch({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={enabled}
      className={`
        relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full
        transition-colors duration-200
        ${enabled ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}
      `}
    >
      <span
        className={`
          inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm
          transition-transform duration-200
          ${enabled ? 'translate-x-4' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgePanel({
  t,
  dir,
  documents,
  isLoading,
  error,
  onAddFile,
  onRemove,
  onToggle,
  onClearError,
}: KnowledgePanelProps) {
  const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);
  const activeCount = documents.filter((d) => d.enabled && d.status === 'ready').length;

  return (
    <div dir={dir} className="flex flex-col h-full gap-4 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5 text-primary-500" />
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.knowledge}</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-3 text-center">
          <Files className="w-4 h-4 mx-auto mb-1 text-primary-500" />
          <p className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{documents.length}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.totalDocuments}</p>
        </div>
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-3 text-center">
          <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-success-500" />
          <p className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{activeCount}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.activeDocuments}</p>
        </div>
        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-3 text-center">
          <Layers className="w-4 h-4 mx-auto mb-1 text-accent-500" />
          <p className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{totalChunks}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.totalChunks}</p>
        </div>
      </div>

      {/* Upload */}
      <FileUploader
        t={t}
        dir={dir}
        onFile={onAddFile}
        isLoading={isLoading}
        error={error}
        onClearError={onClearError}
      />

      {/* Document list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
            <FileText className="w-10 h-10 text-neutral-300 dark:text-neutral-600" />
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t.noDocuments}</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs">{t.noDocumentsDesc}</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className={`
                rounded-xl border p-3 transition-colors
                ${doc.status === 'error'
                  ? 'border-error-200 dark:border-error-800 bg-error-50/50 dark:bg-error-950/20'
                  : doc.enabled
                    ? 'border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20'
                    : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50'
              }
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className={`w-4 h-4 flex-shrink-0 mt-0.5 ${doc.enabled ? 'text-primary-500' : 'text-neutral-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate" title={doc.name}>
                      {doc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{formatBytes(doc.sizeBytes)}</span>
                      {doc.status === 'ready' && (
                        <>
                          <span>·</span>
                          <span>{doc.chunkCount} {t.chunks}</span>
                        </>
                      )}
                      <span>·</span>
                      <StatusBadge status={doc.status} t={t} />
                    </div>
                    {doc.errorMessage && (
                      <p className="text-xs text-error-600 dark:text-error-400 mt-1" dir={dir}>
                        {doc.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {doc.status === 'ready' && (
                    <ToggleSwitch enabled={doc.enabled} onClick={() => onToggle(doc.id)} />
                  )}
                  <button
                    onClick={() => onRemove(doc.id)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors"
                    title={t.remove}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
