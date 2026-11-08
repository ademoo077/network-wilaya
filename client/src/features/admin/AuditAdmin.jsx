import { useCallback, useEffect, useState } from 'react';
import { AUDIT_ACTIONS, formatDateTime } from '@anm/shared';
import { api, download, queryString } from '../../api/client.js';
import { Button, Card, DataTable, Input, Pagination, Select, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function AuditAdmin() {
  const { t } = useI18n();
  const { push } = useToast();
  const [filters, setFilters] = useState({ action: '', user: '', from: '', to: '', page: 1, pageSize: 25 });
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 25 });
  const signature = queryString(filters);
  const load = useCallback(() => api(`/admin/audit${signature}`).then(setData), [signature]);
  useEffect(() => { load().catch((error) => push(error.message, 'danger')); }, [load, push]);
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) }));
  const columns = [
    { key: 'at', label: t('field.date'), render: (row) => formatDateTime(row.at) },
    { key: 'username', label: t('admin.users'), render: (row) => <bdi>{row.username || '—'}</bdi> },
    { key: 'action', label: t('admin.action'), render: (row) => t(`audit.${row.action}`) },
    { key: 'entite', label: t('admin.entity'), render: (row) => <bdi>{row.entite || '—'}</bdi> },
    { key: 'details_json', label: t('common.details'), render: (row) => <code className="block max-w-xs truncate text-xs"><bdi>{row.details_json || '—'}</bdi></code> },
    { key: 'ip', label: t('admin.ip') },
  ];
  return <><Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><Select label={t('admin.action')} placeholder={t('common.all')} value={filters.action} options={AUDIT_ACTIONS.map((value) => ({ value, label: t(`audit.${value}`) }))} onChange={(event) => set('action', event.target.value)} /><Input label={t('admin.users')} value={filters.user} onChange={(event) => set('user', event.target.value)} /><Input label={t('field.from')} type="date" value={filters.from} onChange={(event) => set('from', event.target.value)} /><Input label={t('field.to')} type="date" value={filters.to} onChange={(event) => set('to', event.target.value)} /><Button className="self-end" variant="secondary" onClick={() => download(`/admin/audit/export${signature}`, 'audit.csv')}>{t('common.export')}</Button></Card><Card className="overflow-hidden"><DataTable columns={columns} rows={data.items} /><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => set('page', page)} onPageSize={(pageSize) => set('pageSize', pageSize)} /></Card></>;
}
