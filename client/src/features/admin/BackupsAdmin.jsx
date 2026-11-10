import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api, download } from '../../api/client.js';
import { Button, Card, DataTable, Dialog, EmptyState, Input } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { formatDateTime } from '@anm/shared';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useI18n } from '../../i18n/index.jsx';

export default function BackupsAdmin() {
  const { t } = useI18n(); const client = useQueryClient(); const query = useApiQuery('/admin/backups'); const action = useAsyncAction();
  const [restore, setRestore] = useState(null); const [confirm, setConfirm] = useState(''); const rows = query.data?.items ?? [];
  const columns = [
    { key: 'date', label: t('field.date'), render: (row) => formatDateTime(row.date) },
    { key: 'nom', label: t('field.name'), render: (row) => <bdi>{row.nom}</bdi> },
    { key: 'taille', label: t('admin.size'), render: (row) => `${Math.round(row.taille / 1024)} Ko` },
    { key: 'type', label: t('common.details'), render: (row) => t(`admin.${row.type === 'auto' ? 'automatic' : row.type === 'securite' ? 'safety' : 'manual'}`) },
    { key: 'actions', label: t('common.actions'), render: (row) => <div className="flex gap-1">
      <Button size="sm" variant="ghost" aria-label={t('common.export')} disabled={action.isPending} onClick={() => action.run(() => download(`/admin/backups/${encodeURIComponent(row.nom)}/download`, row.nom))}><Download className="h-4 w-4" /></Button>
      <Button size="sm" variant="ghost" aria-label={t('common.restore')} disabled={action.isPending} onClick={() => setRestore(row)}><RotateCcw className="h-4 w-4" /></Button>
      <Button size="sm" variant="ghost" aria-label={t('common.delete')} disabled={action.isPending} onClick={() => action.run(async () => { await api(`/admin/backups/${encodeURIComponent(row.nom)}`, { method: 'DELETE' }); await query.refetch(); })}><Trash2 className="h-4 w-4" /></Button>
    </div> },
  ];
  return <><div className="flex justify-end"><Button loading={action.isPending} onClick={() => action.run(async () => { await api('/admin/backups', { method: 'POST', body: {} }); await query.refetch(); })}><Plus className="h-4 w-4" />{t('admin.newBackup')}</Button></div>
    <Card className="mt-4 overflow-hidden"><QueryContent query={query}>{rows.length ? <DataTable columns={columns} rows={rows} rowKey="nom" /> : <EmptyState icon={DatabaseBackup} title={t('common.noData')} />}</QueryContent></Card>
    <Dialog open={Boolean(restore)} onClose={() => setRestore(null)} title={t('common.restore')} footer={<><Button variant="ghost" onClick={() => setRestore(null)}>{t('common.cancel')}</Button>
      <Button variant="danger" loading={action.isPending} disabled={confirm !== t('admin.restoreWord')} onClick={() => action.run(async () => {
        await api(`/admin/backups/${encodeURIComponent(restore.nom)}/restore`, { method: 'POST', body: { confirm: 'RESTAURER' } }); setRestore(null); setConfirm(''); await client.invalidateQueries();
      })}>{t('common.restore')}</Button></>}><Input label={t('admin.restoreConfirm')} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></Dialog></>;
}
