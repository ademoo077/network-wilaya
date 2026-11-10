import { useState } from 'react';
import { AUDIT_ACTIONS, formatDateTime } from '@anm/shared';
import { download, queryString } from '../../api/client.js';
import { Button, Card, DataTable, Input, Pagination, Select, EmptyState } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AuditAdmin() {
  const { t } = useI18n(); const action = useAsyncAction();
  const [filters, setFilters] = useState({ action: '', user: '', from: '', to: '', page: 1, pageSize: 25 });
  const user = useDebounced(filters.user); const signature = queryString({ ...filters, user }); const query = useApiQuery(`/admin/audit${signature}`);
  const data = query.data ?? { items: [], total: 0, page: 1, pageSize: 25 };
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }));
  const columns = [
    { key: 'at', label: t('field.date'), render: (row) => formatDateTime(row.at) },
    { key: 'username', label: t('admin.users'), render: (row) => <bdi>{row.username || '—'}</bdi> },
    { key: 'action', label: t('admin.action'), render: (row) => t(`audit.${row.action}`) },
    { key: 'entite', label: t('admin.entity'), render: (row) => <bdi>{row.entite || '—'}</bdi> },
    { key: 'details_json', label: t('common.details'), render: (row) => <code className="block max-w-xs truncate text-xs"><bdi>{row.details_json || '—'}</bdi></code> },
    { key: 'ip', label: t('admin.ip') },
  ];
  return <><Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><Select label={t('admin.action')} placeholder={t('common.all')} value={filters.action}
    options={AUDIT_ACTIONS.map((value) => ({ value, label: t(`audit.${value}`) }))} onChange={(event) => set('action', event.target.value)} />
    <Input label={t('admin.users')} value={filters.user} onChange={(event) => set('user', event.target.value)} />
    <Input label={t('field.from')} type="date" value={filters.from} onChange={(event) => set('from', event.target.value)} />
    <Input label={t('field.to')} type="date" value={filters.to} onChange={(event) => set('to', event.target.value)} />
    <Button className="self-end" variant="secondary" loading={action.isPending} onClick={() => action.run(() => download(`/admin/audit/export${signature}`, 'audit.csv'))}>{t('common.export')}</Button></Card>
    <Card className="overflow-hidden"><QueryContent query={query}><DataTable columns={columns} rows={data.items ?? []} empty={<EmptyState title={t('common.noData')} />} />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => set('page', page)} onPageSize={(pageSize) => set('pageSize', pageSize)} /></QueryContent></Card></>;
}
