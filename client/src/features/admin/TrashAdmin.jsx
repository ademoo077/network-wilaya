import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2 } from 'lucide-react';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { invalidateAnomalies } from '../../api/anomalyCache.js';
import { Button, Card, DataTable, EmptyState } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useI18n } from '../../i18n/index.jsx';

export default function TrashAdmin() {
  const { t } = useI18n(); const client = useQueryClient(); const action = useAsyncAction();
  const query = useApiQuery('/anomalies?corbeille=1&pageSize=200&include_infirmees=1'); const rows = query.data?.items ?? [];
  const columns = [
    { key: 'reference', label: t('field.reference'), render: (row) => <bdi className="font-bold">{row.reference}</bdi> },
    { key: 'deleted_at', label: t('field.date'), render: (row) => formatDateTime(row.deleted_at) },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button size="sm" loading={action.isPending} onClick={() => action.run(async () => {
      await api(`/anomalies/${row.id}/restore`, { method: 'POST', body: {} }); await invalidateAnomalies(client);
    })}><RotateCcw className="h-4 w-4" />{t('common.restore')}</Button> },
  ];
  return <Card className="overflow-hidden"><QueryContent query={query}>{rows.length ? <DataTable columns={columns} rows={rows} /> : <EmptyState icon={Trash2} title={t('common.noData')} />}</QueryContent></Card>;
}
