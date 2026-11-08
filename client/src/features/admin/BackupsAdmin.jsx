import { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api, download } from '../../api/client.js';
import { Button, Card, DataTable, Dialog, EmptyState, Input, useToast } from '../../components/ui/index.js';
import { formatDateTime } from '@anm/shared';
import { useI18n } from '../../i18n/index.jsx';

export default function BackupsAdmin() {
  const { t } = useI18n();
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [restore, setRestore] = useState(null);
  const [confirm, setConfirm] = useState('');
  const load = useCallback(() => api('/admin/backups').then((result) => setRows(result.items)), []);
  useEffect(() => { load().catch((error) => push(error.message, 'danger')); }, [load, push]);
  const create = async () => { try { await api('/admin/backups', { method: 'POST', body: {} }); await load(); push(t('common.success')); } catch (error) { push(error.message, 'danger'); } };
  const remove = async (row) => { try { await api(`/admin/backups/${encodeURIComponent(row.nom)}`, { method: 'DELETE' }); await load(); } catch (error) { push(error.message, 'danger'); } };
  const restoreNow = async () => { try { await api(`/admin/backups/${encodeURIComponent(restore.nom)}/restore`, { method: 'POST', body: { confirm } }); setRestore(null); setConfirm(''); await load(); push(t('common.success')); } catch (error) { push(error.message, 'danger'); } };
  const columns = [
    { key: 'date', label: t('field.date'), render: (row) => formatDateTime(row.date) },
    { key: 'nom', label: t('field.name'), render: (row) => <bdi>{row.nom}</bdi> },
    { key: 'taille', label: t('admin.size'), render: (row) => `${Math.round(row.taille / 1024)} Ko` },
    { key: 'type', label: t('common.details'), render: (row) => t(`admin.${row.type === 'auto' ? 'automatic' : row.type === 'securite' ? 'safety' : 'manual'}`) },
    { key: 'actions', label: t('common.actions'), render: (row) => <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => download(`/admin/backups/${encodeURIComponent(row.nom)}/download`, row.nom)}><Download className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => setRestore(row)}><RotateCcw className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></Button></div> },
  ];
  return <><div className="flex justify-end"><Button onClick={create}><Plus className="h-4 w-4" />{t('admin.newBackup')}</Button></div><Card className="mt-4 overflow-hidden">{rows.length ? <DataTable columns={columns} rows={rows} rowKey="nom" /> : <EmptyState icon={DatabaseBackup} title={t('common.noData')} />}</Card><Dialog open={Boolean(restore)} onClose={() => setRestore(null)} title={t('common.restore')} footer={<><Button variant="ghost" onClick={() => setRestore(null)}>{t('common.cancel')}</Button><Button variant="danger" disabled={confirm !== t('admin.restoreWord')} onClick={restoreNow}>{t('common.restore')}</Button></>}><Input label={t('admin.restoreConfirm')} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Dialog></>;
}
