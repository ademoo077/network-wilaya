import { useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, DataTable, Dialog, Input, Select, useToast } from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useOptimisticRows } from '../../hooks/useOptimisticRows.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useI18n } from '../../i18n/index.jsx';

export default function UsersAdmin() {
  const { t } = useI18n(); const { push } = useToast(); const query = useApiQuery('/users'); const update = useOptimisticRows('/users');
  const action = useAsyncAction(); const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', full_name: '', role: 'lecteur', password: '' });
  const roles = ['admin', 'operateur', 'lecteur'].map((value) => ({ value, label: t(`role.${value}`) }));
  const columns = [
    { key: 'username', label: t('auth.username'), render: (row) => <bdi className="font-bold">{row.username}</bdi> },
    { key: 'full_name', label: t('field.name') },
    { key: 'role', label: t('field.role'), render: (row) => <Select aria-label={`${t('field.role')} ${row.username}`} value={row.role} options={roles} disabled={update.isPending}
      onChange={(event) => update.mutate({ row, changes: { role: event.target.value } })} /> },
    { key: 'actif', label: t('common.active'), render: (row) => <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ row, changes: { actif: row.actif ? 0 : 1 } })}>{t(row.actif ? 'common.yes' : 'common.no')}</Button> },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button size="sm" variant="ghost" loading={action.isPending} onClick={() => action.run(async () => {
      const result = await api(`/users/${row.id}/reset-password`, { method: 'POST', body: {} }); push(t('admin.tempPassword', { password: result.item.password }), 'warning');
    })}><RotateCcw className="h-4 w-4" />{t('admin.resetPassword')}</Button> },
  ];
  return <><div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('common.add')}</Button></div>
    <Card className="mt-4 overflow-hidden"><QueryContent query={query}><DataTable columns={columns} rows={query.data?.items ?? []} /></QueryContent></Card>
    <Dialog open={open} onClose={() => setOpen(false)} title={t('common.add')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
      <Button type="submit" form="create-user" loading={action.isPending}>{t('common.save')}</Button></>}>
      <form id="create-user" className="space-y-4" onSubmit={(event) => { event.preventDefault(); action.run(async () => {
        await api('/users', { method: 'POST', body: form }); setOpen(false); setForm({ username: '', full_name: '', role: 'lecteur', password: '' }); await query.refetch();
      }); }}>
        <Input label={t('auth.username')} required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        <Input label={t('field.name')} required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
        <Select label={t('field.role')} value={form.role} options={roles} onChange={(event) => setForm({ ...form, role: event.target.value })} />
        <Input label={t('auth.password')} type="password" required hint={t('profile.policy')} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
      </form>
    </Dialog></>;
}
