// ============================================================================
// BackupSettings — Data & Backup panel (Phase 9)
// One-click export, drag-and-drop import, storage quota, factory reset
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download, Upload, Lock, AlertTriangle, Trash2, HardDrive,
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
} from 'lucide-react';
import type { Translation } from '@/lib/i18n';
import type { RestoreMode, RestoreSummary, StorageEstimateInfo } from '@/types';
import {
  createSnapshot,
  downloadSnapshot,
  validateSnapshot,
  restoreSnapshot,
  decryptSnapshot,
  getStorageEstimate,
} from '@/lib/backupManager';

interface BackupSettingsProps {
  t: Translation;
  dir: 'rtl' | 'ltr';
  onFactoryReset: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function BackupSettings({ t, dir, onFactoryReset }: BackupSettingsProps) {
  const [includeKeys, setIncludeKeys] = useState(false);
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [importPassword, setImportPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshStorage = useCallback(() => {
    getStorageEstimate().then((estimate) => {
      setStorage({ usageBytes: estimate.usage, quotaBytes: estimate.quota });
    }).catch(() => {
      setStorage(null);
    });
  }, []);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (encrypt && !password.trim()) {
        setMessage({ kind: 'error', text: t.backupPassword });
        return;
      }
      const snapshot = await createSnapshot({
        includeApiKeys: includeKeys,
        password: encrypt ? password : undefined,
      });
      downloadSnapshot(snapshot);
      setMessage({ kind: 'success', text: t.backupExported });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setMessage({ kind: 'error', text: msg });
    } finally {
      setBusy(false);
    }
  }, [encrypt, password, includeKeys, t]);

  const processFile = useCallback(async (file: File) => {
    setMessage(null);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const result = validateSnapshot(parsed);
      if (!result.valid) {
        setMessage({ kind: 'error', text: `${t.invalidBackup}: ${result.error ?? ''}` });
        return;
      }
      if (result.encrypted) {
        setNeedsPassword(true);
        setPendingFile(file);
        setMessage({ kind: 'success', text: t.backupPassword });
        return;
      }
      setPendingFile(file);
      setNeedsPassword(false);
      await runRestore(result.snapshot!.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.importFailed;
      setMessage({ kind: 'error', text: msg });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, restoreMode]);

  const runRestore = useCallback(async (data: Parameters<typeof restoreSnapshot>[0]) => {
    setBusy(true);
    try {
      const summary: RestoreSummary = await restoreSnapshot(data, restoreMode);
      const details = [
        `${summary.conversationsAdded} ${t.chat}`,
        `${summary.documentsAdded} ${t.totalDocuments}`,
        `${summary.personasAdded} ${t.personas}`,
        `${summary.promptsAdded} ${t.promptLibrary}`,
        `${summary.providersAdded + summary.providersUpdated} ${t.providers}`,
      ].join(', ');
      setMessage({ kind: 'success', text: `${t.importSuccess} — ${details}` });
      refreshStorage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.importFailed;
      setMessage({ kind: 'error', text: `${t.importFailed}: ${msg}` });
    } finally {
      setBusy(false);
      setPendingFile(null);
      setImportPassword('');
    }
  }, [restoreMode, t, refreshStorage]);

  const handleImportPasswordSubmit = useCallback(async () => {
    if (!pendingFile || !importPassword.trim()) return;
    setBusy(true);
    try {
      const text = await pendingFile.text();
      const parsed: unknown = JSON.parse(text);
      const result = validateSnapshot(parsed);
      if (!result.valid || !result.encrypted) {
        setMessage({ kind: 'error', text: t.invalidBackup });
        return;
      }
      const data = await decryptSnapshot(result.encrypted, importPassword);
      await runRestore(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.wrongPassword;
      setMessage({ kind: 'error', text: msg });
    } finally {
      setBusy(false);
    }
  }, [pendingFile, importPassword, runRestore, t]);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      setMessage({ kind: 'error', text: t.invalidBackup });
      return;
    }
    processFile(file);
  }, [processFile, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleFactoryReset = useCallback(async () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setBusy(true);
    try {
      await onFactoryReset();
      setMessage({ kind: 'success', text: t.importSuccess });
      refreshStorage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setMessage({ kind: 'error', text: msg });
    } finally {
      setBusy(false);
      setResetArmed(false);
    }
  }, [resetArmed, onFactoryReset, t, refreshStorage]);

  const usagePct = storage && storage.quotaBytes > 0
    ? Math.min((storage.usageBytes / storage.quotaBytes) * 100, 100)
    : 0;

  return (
    <div dir={dir} className="h-full overflow-y-auto bg-white dark:bg-neutral-900">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{t.dataBackup}</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">{t.backupDesc}</p>
        </div>

        {/* Status message */}
        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
              message.kind === 'success'
                ? 'bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-400'
                : 'bg-error-50 dark:bg-error-950/30 text-error-700 dark:text-error-400'
            }`}
          >
            {message.kind === 'success'
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        {/* Export section */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-100">
            <Download className="w-4 h-4" />
            {t.exportBackup}
          </h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeKeys}
              onChange={(e) => setIncludeKeys(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary-600"
            />
            <span>
              <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">{t.includeApiKeys}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                {includeKeys
                  ? <span className="inline-flex items-center gap-1 text-warning-600 dark:text-warning-400"><ShieldAlert className="w-3 h-3" />{t.includeApiKeysDesc}</span>
                  : <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" />{t.includeApiKeysDesc}</span>}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary-600"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800 dark:text-neutral-100">
                <Lock className="w-3.5 h-3.5" />
                {t.encryptBackup}
              </span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{t.backupPasswordDesc}</span>
            </span>
          </label>

          {encrypt && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.backupPassword}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          )}

          <button
            onClick={handleExport}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            {t.exportBackup}
          </button>
        </section>

        {/* Import section */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-100">
            <Upload className="w-4 h-4" />
            {t.importBackup}
          </h3>

          {/* Restore mode */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.restoreMode}</p>
            <div className="grid grid-cols-2 gap-3">
              {(['merge', 'overwrite'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRestoreMode(mode)}
                  className={`text-start rounded-lg border p-3 transition-all ${
                    restoreMode === mode
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">
                    {mode === 'merge' ? t.mergeMode : t.overwriteMode}
                  </span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                    {mode === 'merge' ? t.mergeModeDesc : t.overwriteModeDesc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400'
            }`}
          >
            <Upload className="w-6 h-6 mx-auto text-neutral-400" />
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{t.dropBackupHere}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

          {/* Password prompt for encrypted backups */}
          {needsPassword && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder={t.backupPassword}
                className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleImportPasswordSubmit}
                disabled={busy || !importPassword.trim()}
                className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap"
              >
                {busy ? t.importing : t.confirm}
              </button>
            </div>
          )}
        </section>

        {/* Storage quota */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 space-y-3">
          <h3 className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-100">
            <HardDrive className="w-4 h-4" />
            {t.storageUsed}
          </h3>
          {storage && storage.quotaBytes > 0 ? (
            <>
              <div className="h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${Math.max(usagePct, 0.5)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatBytes(storage.usageBytes)} {t.storageOf} {formatBytes(storage.quotaBytes)}
                {' '}({usagePct.toFixed(2)}%)
              </p>
            </>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">—</p>
          )}
        </section>

        {/* Factory reset */}
        <section className="rounded-xl border border-error-200 dark:border-error-900 p-5 space-y-3">
          <h3 className="flex items-center gap-2 font-medium text-error-700 dark:text-error-400">
            <AlertTriangle className="w-4 h-4" />
            {t.factoryReset}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{t.factoryResetDesc}</p>
          {resetArmed && (
            <p className="text-sm font-medium text-error-700 dark:text-error-400 bg-error-50 dark:bg-error-950/30 rounded-lg px-3 py-2">
              {t.factoryResetConfirm}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleFactoryReset}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                resetArmed
                  ? 'bg-error-600 hover:bg-error-700 text-white'
                  : 'bg-error-50 dark:bg-error-950/30 text-error-700 dark:text-error-400 hover:bg-error-100'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {resetArmed ? t.confirm : t.factoryReset}
            </button>
            {resetArmed && (
              <button
                onClick={() => setResetArmed(false)}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                {t.cancel}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
