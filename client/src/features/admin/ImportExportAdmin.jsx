import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { api, download } from '../../api/client.js';
import { Alert, Button, Card, CardHeader, DataTable, Select, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function ImportExportAdmin() {
  const { t } = useI18n();
  const { push } = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('valid_only');
  const [loading, setLoading] = useState(false);
  const runPreview = async () => {
    if (!file) return; setLoading(true);
    const body = new FormData(); body.append('file', file);
    try { const result = await api('/anomalies/import/preview', { method: 'POST', body }); setPreview(result.item); } catch (error) { push(error.message, 'danger'); } finally { setLoading(false); }
  };
  const commit = async () => { setLoading(true); try { const result = await api('/anomalies/import/commit', { method: 'POST', body: { importId: preview.importId, mode } }); push(t('anomalies.bulkResult', { ok: result.item.created, failed: result.item.errors.length })); setPreview(null); setFile(null); } catch (error) { push(error.message, 'danger'); } finally { setLoading(false); } };
  const columns = [
    { key: 'ligne', label: t('common.rows') }, { key: 'statut', label: t('field.status') },
    { key: 'messages', label: t('common.details'), render: (row) => <bdi>{row.messages.join(' · ') || '—'}</bdi> },
  ];
  return <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader title={t('common.export')} /><div className="grid gap-3 p-5 sm:grid-cols-2"><Button variant="secondary" onClick={() => download('/anomalies/export?format=xlsx', 'anomalies.xlsx')}><FileSpreadsheet className="h-4 w-4" />{t('anomalies.exportXlsx')}</Button><Button variant="secondary" onClick={() => download('/anomalies/export?format=csv', 'anomalies.csv')}>{t('anomalies.exportCsv')}</Button></div></Card><Card><CardHeader title={t('common.import')} /><div className="space-y-4 p-5"><Button variant="ghost" onClick={() => download('/anomalies/import/template', 'modele.csv')}>{t('admin.template')}</Button><label className="grid min-h-28 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-surface2 p-4 text-sm text-muted"><Upload className="mb-2 h-6 w-6" /><span><bdi>{file?.name || t('form.dropFiles')}</bdi></span><input className="sr-only" type="file" accept=".csv,.xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} /></label><Button className="w-full" loading={loading} disabled={!file} onClick={runPreview}>{t('setup.preview')}</Button></div></Card>{preview && <Card className="lg:col-span-2"><CardHeader title={t('admin.importPreview')} /><div className="p-5"><Alert variant={preview.summary.error ? 'warning' : 'success'}>{preview.summary.total} {t('common.rows')} · {preview.summary.ok} OK · {preview.summary.warning} warning · {preview.summary.error} error</Alert><div className="mt-4 max-h-96 overflow-auto"><DataTable columns={columns} rows={preview.rows} rowKey="ligne" /></div><div className="mt-4 flex flex-wrap justify-end gap-3"><Select aria-label={t('common.import')} value={mode} options={[{ value: 'valid_only', label: t('admin.validOnly') }, { value: 'all_or_nothing', label: t('admin.allOrNothing') }]} onChange={(event) => setMode(event.target.value)} /><Button loading={loading} onClick={commit}>{t('common.import')}</Button></div></div></Card>}</div>;
}
