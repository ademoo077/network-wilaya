import { useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { MAX_UPLOAD_BYTES, reseauxSociauxImportPreviewSchema, reseauxSociauxImportResultSchema } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, DataTable, Dialog, Input, PlatformBadge } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { CompteSocialType } from './CompteSocialBadges.jsx';

export default function ReseauxSociauxImportDialog({ onClose, onChanged }) {
  const { t } = useI18n();
  const [file, setFile] = useState(null); const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const close = () => { if (!busy) onClose(); };
  const inspect = async (supplied = false) => {
    if (busy || (!supplied && !file)) return;
    if (!supplied && file.size > MAX_UPLOAD_BYTES) { setError(t('social.fileTooLarge')); return; }
    setBusy(true); setError(null);
    try {
      const body = new FormData(); if (!supplied) body.append('file', file);
      const response = await api(supplied ? '/reseaux-sociaux/import/fourni' : '/reseaux-sociaux/import/preview',
        { method: 'POST', ...(supplied ? {} : { body }), schema: reseauxSociauxImportPreviewSchema, fallback: null });
      if (!response?.item) throw new Error(t('social.badResponse'));
      setPreview(response.item);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (busy || !preview?.summary.nouveaux) return;
    setBusy(true); setError(null);
    try {
      const response = await api('/reseaux-sociaux/import/commit', { method: 'POST', body: { importId: preview.importId },
        schema: reseauxSociauxImportResultSchema, fallback: null });
      if (!response?.item) throw new Error(t('social.badResponse'));
      setResult(response.item); await onChanged();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const columns = [
    { key: 'key', label: t('social.sourceRow'), render: (row) => <bdi>{row.ligne}:{row.colonne}</bdi> },
    { key: 'nom', label: t('social.name'), render: (row) => <bdi className="block max-w-xs break-words">{row.nom || t('social.missingName')}</bdi> },
    { key: 'plateforme', label: t('social.network'), render: (row) => <PlatformBadge value={row.plateforme} /> },
    { key: 'categorie', label: t('social.accountType'), render: (row) => <CompteSocialType value={row.categorie} /> },
    { key: 'commune_libelle', label: t('field.commune'), render: (row) => <div><bdi>{row.commune_libelle || '—'}</bdi><bdi className="block text-xs text-muted">{row.ca_libelle || '—'}</bdi></div> },
    { key: 'statut', label: t('social.importStatus'), render: (row) => <span className={`text-xs font-bold ${row.statut === 'erreur' ? 'text-danger' : row.statut === 'nouveau' ? 'text-brand-700' : 'text-muted'}`}>{t(`social.import.${row.statut}`)}</span> },
    { key: 'messages', label: t('social.checks'), render: (row) => <p className="max-w-xs text-xs text-muted"><bdi>{row.erreur || row.messages.map((message) => t(`social.warning.${message}`)).join(' · ')}</bdi></p> },
  ];
  return <Dialog open title={t('social.importTitle')} onClose={close} size={preview ? 'xl' : 'lg'} footer={result ? <Button onClick={close}>{t('social.finish')}</Button>
    : <><Button variant="secondary" disabled={busy} onClick={close}>{t('common.cancel')}</Button>
      {preview && <Button loading={busy} disabled={!preview.summary.nouveaux} onClick={commit}><Upload className="h-4 w-4" aria-hidden="true" />{t('social.importValid', { count: preview.summary.nouveaux })}</Button>}</>}>
    {error && <Alert className="mb-4" variant="danger">{error}</Alert>}
    {result ? <div className="space-y-4">
      <div className="flex items-start gap-3"><CheckCircle2 className="h-8 w-8 shrink-0 text-brand-700" aria-hidden="true" /><div><h3 className="text-lg font-bold">{t('social.importDone')}</h3>
        <p className="mt-1 text-sm text-ink2">{t('social.importResult', { created: result.created, skipped: result.skipped })}</p></div></div>
      <Alert variant="success">{t('social.importPreserved')}</Alert><p className="text-sm text-muted">{t('social.importVerification')}</p>
      {result.errors.length > 0 && <Alert variant="warning">{t('social.importErrors', { count: result.errors.length })}</Alert>}
    </div> : preview ? <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold"><bdi>{preview.fichier}</bdi><span className="ms-2 text-muted">{preview.feuille}</span></p>
        <Button variant="ghost" disabled={busy} onClick={() => { setPreview(null); setError(null); }}>{t('social.changeFile')}</Button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['nouveaux', 'existants', 'doublons', 'erreurs'].map((key) => <div key={key} className="rounded-md border border-border bg-surface2 p-3">
        <p className="text-2xl font-black">{preview.summary[key]}</p><p className="mt-1 text-xs text-muted">{t(`social.summary.${key}`)}</p>
      </div>)}</div>
      <Alert variant="info" title={t('social.importSafety')}>{t('social.importPreserved')} {t('social.importVerification')}</Alert>
      {!!preview.summary.sans_lien && <p className="text-xs text-muted">{t('social.noLinkRows', { count: preview.summary.sans_lien })}</p>}
      {!!preview.summary.erreurs && <Alert variant="warning">{t('social.importErrors', { count: preview.summary.erreurs })}</Alert>}
      <DataTable columns={columns} rows={preview.rows.map((row) => ({ ...row, key: `${row.ligne}:${row.colonne}` }))} rowKey="key"
        scrollClassName="max-h-80 rounded-md border border-border" scrollLabel={t('social.importPreviewTable')} />
      {!preview.summary.nouveaux && <p role="status" className="text-sm font-semibold text-brand-700">{t('social.nothingToImport')}</p>}
    </div> : <div className="space-y-5">
      <p className="text-sm text-ink2">{t('social.importHelp')}</p>
      <div className="rounded-lg border border-border bg-surface2 p-4"><h3 className="font-bold">{t('social.suppliedFile')}</h3>
        <p className="mt-1 text-sm text-muted">{t('social.suppliedFileHelp')}</p><Button className="mt-3" variant="secondary" loading={busy} onClick={() => inspect(true)}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />{t('social.previewSupplied')}</Button></div>
      <fieldset disabled={busy} className="min-w-0 space-y-3"><Input type="file" label={t('social.chooseFile')} accept=".xlsx" hint={t('social.fileHelp')}
        onChange={(event) => { setFile(event.target.files?.[0] || null); setError(null); }} />
        <Button variant="secondary" loading={busy} disabled={!file} onClick={() => inspect(false)}><Upload className="h-4 w-4" aria-hidden="true" />{t('social.previewFile')}</Button>
      </fieldset>
    </div>}
  </Dialog>;
}
