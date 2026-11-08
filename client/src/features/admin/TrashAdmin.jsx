import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Card, DataTable, EmptyState, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function TrashAdmin() {
  const { t } = useI18n();
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const load = useCallback(() => api('/anomalies?corbeille=1&pageSize=200&include_infirmees=1').then((result) => setRows(result.items)), []);
  useEffect(() => { load().catch((error) => push(error.message, 'danger')); }, [load, push]);
  const restore = async (row) => { try { await api(`/anomalies/${row.id}/restore`, { method: 'POST', body: {} }); await load(); push(t('common.success')); } catch (error) { push(error.message, 'danger'); } };
  const columns = [
    { key: 'reference', label: t('field.reference'), render: (row) => <bdi className="font-bold">{row.reference}</bdi> },
    { key: 'deleted_at', label: t('field.date'), render: (row) => formatDateTime(row.deleted_at) },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button size="sm" onClick={() => restore(row)}><RotateCcw className="h-4 w-4" />{t('common.restore')}</Button> },
  ];
  return <Card className="overflow-hidden">{rows.length ? <DataTable columns={columns} rows={rows} /> : <EmptyState icon={Trash2} title={t('common.noData')} />}</Card>;
}
