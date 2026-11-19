import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { MAX_UPLOAD_BYTES, formatDate } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, DataTable, Dialog, Select, StatusBadge, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

const ALLOWED_EXTENSIONS = /\.(xlsx|xls|csv)$/i;
const MAX_SIZE = MAX_UPLOAD_BYTES || 5 * 1024 * 1024;
const PAGE_ROWS = 200;

/** Importe des anomalies depuis un classeur Excel / CSV, avec aperçu et rapport. */
export default function ImportAnomaliesDialog({ open, onClose, onImported, refs }) {
  const { t, lang } = useI18n();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState('valid_only');
  const [agentId, setAgentId] = useState('');
  const [epicId, setEpicId] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [success, setSuccess] = useState(false);
  const [agentOpts, setAgentOpts] = useState([]);
  const [epicOpts, setEpicOpts] = useState([]);

  /** Réinitialise le dialogue à la fermeture. */
  const reset = useCallback(() => {
    requestRef.current += 1;
    setFile(null); setPreview(null); setError(null);
    setLoading(false); setCommitting(false);
    setDragging(false); setMode('valid_only');
    setAgentId(''); setEpicId('');
    setSearch(''); setStatusFilter('all'); setShowAll(false);
    setSuccess(false);
  }, []);

  /** Fermeture effective : nettoie puis notifie le parent. */
  const handleClose = useCallback(() => {
    reset();
    if (typeof onClose === 'function') onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (open) return undefined;
    reset();
    return undefined;
  }, [open, reset]);

  useEffect(() => {
    if (!open || !refs) return;
    const epics = refs.epics || [];
    const agents = refs.agents || [];
    setEpicOpts(epics.map((e) => ({ value: String(e.id), label: e.name || e.sigle || `#${e.id}` })));
    setAgentOpts(agents.map((a) => ({ value: String(a.id), label: a.full_name || a.username || `#${a.id}` })));
  }, [open, refs]);

  /** Affiche le message d'erreur pour un fichier. */
  const accept = useCallback((nextFile) => {
    if (!nextFile) return false;
    if (!ALLOWED_EXTENSIONS.test(nextFile.name)) { setError(t('import.invalidFile')); return false; }
    if (nextFile.size > MAX_SIZE) { setError(t('import.tooLarge')); return false; }
    return true;
  }, [t]);

  /** Analyse le fichier auprès de l'API d'aperçu. */
  const analyze = useCallback(async (nextFile, options = {}) => {
    if (!nextFile) return;
    if (!accept(nextFile)) return;
    const id = ++requestRef.current;
    setFile(nextFile);
    setPreview(null); setError(null); setLoading(true); setSuccess(false);
    const body = new FormData();
    body.append('file', nextFile);
    const agent = options.agentId ?? agentId;
    const epic = options.epicId ?? epicId;
    if (agent) body.append('agent_id', agent);
    if (epic) body.append('epic_id', epic);
    try {
      const result = await api('/anomalies/import/preview', { method: 'POST', body });
      if (id !== requestRef.current) return;
      setPreview(result.item);
    } catch (err) {
      if (id === requestRef.current) { setPreview(null); setError(err.message || 'Erreur'); }
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [accept, agentId, epicId]);

  const changeAgent = (value) => {
    setAgentId(value);
    if (file) analyze(file, { agentId: value, epicId });
  };
  const changeEpic = (value) => {
    setEpicId(value);
    if (file) analyze(file, { agentId, epicId: value });
  };

  /** Validation de l'import côté API. */
  const commit = useCallback(async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const result = await api('/anomalies/import/commit', {
        method: 'POST',
        body: { importId: preview.importId, mode },
      });
      const created = result.item.created;
      const failed = result.item.errors?.length || 0;
      const label = created > 0
        ? t('import.result', { created, failed })
        : t('import.none', { failed });
      push(label, failed ? 'warning' : 'success');
      setSuccess(true);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['api', '/anomalies'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
      onImported?.();
    } catch (err) {
      push(err.message || 'Erreur', 'danger');
    } finally {
      setCommitting(false);
    }
  }, [preview, mode, push, t, onImported, queryClient]);

  const summary = preview?.summary || null;
  const allRows = preview?.rows || [];
  const filteredRows = allRows.filter((row) => {
    if (statusFilter !== 'all' && row.statut !== statusFilter) return false;
    if (search) {
      const needle = search.toLowerCase();
      const hay = [row.raw?.commune, row.raw?.type, row.raw?.ca, row.resolved?.type, row.resolved?.categorie].join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, PAGE_ROWS);

  const columns = [
    { key: 'ligne', label: t('import.line'), className: 'w-16', render: (row) => <span className="text-xs text-muted">{row.ligne}</span> },
    { key: 'date', label: t('field.date'), render: (row) => row.resolved?.date ? formatDate(row.resolved.date, lang) : (row.raw?.date || '—') },
    { key: 'commune', label: t('field.commune'), render: (row) => <bdi>{row.resolved?.commune || row.raw?.commune || '—'}</bdi> },
    { key: 'type', label: t('field.type'), render: (row) => (
      <div className="min-w-0">
        <span className="block text-sm"><bdi>{row.raw?.type || '—'}</bdi></span>
        {row.resolved?.type && row.resolved.type !== row.raw?.type && <span className="block text-xs text-muted"><bdi>{row.resolved.categorie} / {row.resolved.type}</bdi></span>}
      </div>
    ) },
    { key: 'statut', label: t('field.status'), render: (row) => (
      <div className="flex flex-col gap-1 items-start">
        {row.resolved?.statut ? <StatusBadge statut={row.resolved.statut} /> : <bdi>{row.raw?.statut || '—'}</bdi>}
        {row.resolved?.statut && row.raw?.statut && row.resolved.statut !== row.raw.statut && <span className="text-xs text-muted"><bdi>{row.raw.statut}</bdi></span>}
      </div>
    ) },
    { key: 'messages', label: t('import.messages'), render: (row) => {
      const messages = row.messages || [];
      if (!messages.length) return <span className="text-muted">—</span>;
      const color = row.statut === 'error' ? 'text-danger' : row.statut === 'warning' ? 'text-warning' : 'text-ink';
      return <div className="flex flex-col gap-0.5 text-xs"><span className={color}>{row.statut === 'error' ? '✕' : row.statut === 'warning' ? '!' : '✓'}</span>{messages.slice(0, 3).map((m) => <span key={m} className="text-xs text-muted"><bdi>{m}</bdi></span>)}{messages.length > 3 && <span className="text-xs text-muted">+{messages.length - 3}</span>}</div>;
    } },
  ];

  const onDrop = (event) => {
    event.preventDefault(); setDragging(false);
    const files = event.dataTransfer?.files;
    if (files?.length) analyze(files[0]);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t('import.title')}
      size="xl"
      footer={(
        <div className="flex flex-wrap justify-between items-center gap-2 w-full">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleClose}>{t('common.cancel')}</Button>
            {preview && <Button variant="ghost" onClick={() => analyze(file)}>{t('import.reanalyze')}</Button>}
          </div>
          {preview && summary && summary.ok + summary.warning > 0 && (
            <Button onClick={commit} disabled={committing} className="min-w-40">
              {committing ? t('common.loading') : t('import.commit', { count: summary.ok + summary.warning })}
            </Button>
          )}
        </div>
      )}
    >
      {success && (
        <div className="mb-4 rounded-sm bg-successbg text-success p-4 text-sm">
          {t('import.done')}
        </div>
      )}

      {error && !preview && (
        <p className="mb-4 text-danger text-sm">{error}</p>
      )}

      {!preview && !error && (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface2 p-3">
            <p className="text-xs font-semibold text-muted mb-2">{t('import.options')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t('import.agent')}
                placeholder="—"
                value={agentId}
                options={agentOpts}
                onChange={(e) => changeAgent(e.target.value)}
                disabled={!refs || !(refs.agents || []).length}
              />
              <Select
                label={t('import.epic')}
                placeholder="—"
                value={epicId}
                options={epicOpts}
                onChange={(e) => changeEpic(e.target.value)}
                disabled={!refs || !(refs.epics || []).length}
              />
            </div>
            <p className="mt-2 text-xs text-muted">{t('import.optionsHelp')}</p>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-6 text-center transition ${dragging ? 'border-brand-600 bg-brand-50' : 'border-border bg-surface hover:bg-surface2'}`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            data-import-dropzone="true"
          >
            <FileSpreadsheet className="h-8 w-8 text-muted" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">{t('import.drop')}</p>
            <p className="text-xs text-muted">{t('import.formats')}</p>
            {file && <p className="text-xs text-muted"><bdi>{file.name}</bdi> · {(file.size / 1024 / 1024).toFixed(1)} Mo</p>}
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => { const picked = e.target.files?.[0]; if (picked) analyze(picked); e.target.value = ''; }}
            data-import-file="true"
          />
          <p className="text-xs text-muted">{t('import.help')}</p>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-sm bg-surface2 px-2 py-1 text-xs font-semibold">{t('import.total', { count: summary.total })}</span>
              <span className="rounded-sm bg-straitebg px-2 py-1 text-xs font-semibold text-straite">{t('import.ready', { count: summary.ok })}</span>
              <span className="rounded-sm bg-stcoursbg px-2 py-1 text-xs font-semibold text-stcours">{t('import.warnings', { count: summary.warning })}</span>
              <span className="rounded-sm bg-stnonbg px-2 py-1 text-xs font-semibold text-stnon">{t('import.errors', { count: summary.error })}</span>
            </div>
            {file && <p className="text-xs text-muted"><bdi>{file.name}</bdi>{preview.sheetName && ` · ${preview.sheetName}`}</p>}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <label htmlFor="import-mode" className="mb-1 block text-xs font-semibold text-muted">{t('import.mode')}</label>
              <Select
                id="import-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                options={[
                  { value: 'valid_only', label: t('import.validOnly') },
                  { value: 'all_or_nothing', label: t('import.allOrNothing') },
                ]}
              />
            </div>
            <div className="min-w-40 flex-1">
              <label htmlFor="import-status" className="mb-1 block text-xs font-semibold text-muted">{t('import.filter')}</label>
              <Select
                id="import-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: t('import.allRows') },
                  { value: 'ok', label: t('import.ready') },
                  { value: 'warning', label: t('import.warnings') },
                  { value: 'error', label: t('import.errors') },
                ]}
              />
            </div>
            <div className="min-w-40 flex-1">
              <label htmlFor="import-search" className="mb-1 block text-xs font-semibold text-muted">{t('common.search')}</label>
              <input
                id="import-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted"
                placeholder={t('import.searchPlaceholder')}
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={visibleRows}
            rowKey="ligne"
            empty={<p className="p-6 text-center text-sm text-muted">{t('import.noRows')}</p>}
            scrollClassName="max-h-[45vh] min-h-40 rounded-sm border border-border"
            scrollLabel={t('import.preview')}
          />
          {filteredRows.length > visibleRows.length && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>{t('import.showAll', { count: filteredRows.length })}</Button>
          )}
          {summary.error > 0 && (
            <p className="text-xs text-muted">{t('import.reportHint')}</p>
          )}
        </div>
      )}
    </Dialog>
  );
}