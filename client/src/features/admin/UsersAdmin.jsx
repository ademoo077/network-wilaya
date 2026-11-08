import { useCallback, useEffect, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, DataTable, Dialog, Input, Select, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function UsersAdmin() {
  const { t } = useI18n();
  const { push } = useToast();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', full_name: '', role: 'lecteur', password: '' });
  const load = useCallback(() => api('/users').then((result) => setRows(result.items)), []);
  useEffect(() => { load().catch((error) => push(error.message, 'danger')); }, [load, push]);
  const update = async (row, changes) => { try { await api(`/users/${row.id}`, { method: 'PATCH', body: changes }); await load(); } catch (error) { push(error.message, 'danger'); } };
  const reset = async (row) => { try { const result = await api(`/users/${row.id}/reset-password`, { method: 'POST', body: {} }); push(t('admin.tempPassword', { password: result.item.password }), 'warning'); } catch (error) { push(error.message, 'danger'); } };
  const create = async () => { try { await api('/users', { method: 'POST', body: form }); setOpen(false); setForm({ username: '', full_name: '', role: 'lecteur', password: '' }); await load(); } catch (error) { push(error.message, 'danger'); } };
  const columns = [
    { key: 'username', label: t('auth.username'), render: (row) => <bdi className="font-bold">{row.username}</bdi> },
    { key: 'full_name', label: t('field.name') },
    { key: 'role', label: t('field.role'), render: (row) => <Select aria-label={t('field.role')} value={row.role} options={['admin', 'operateur', 'lecteur'].map((value) => ({ value, label: t(`role.${value}`) }))} onChange={(event) => update(row, { role: event.target.value })} /> },
    { key: 'actif', label: t('common.active'), render: (row) => <button className="font-bold text-brand-700" onClick={() => update(row, { actif: row.actif ? 0 : 1 })}>{row.actif ? t('common.yes') : t('common.no')}</button> },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button size="sm" variant="ghost" onClick={() => reset(row)}><RotateCcw className="h-4 w-4" />{t('admin.resetPassword')}</Button> },
  ];
  return <><div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('common.add')}</Button></div><Card className="mt-4 overflow-hidden"><DataTable columns={columns} rows={rows} /></Card><Dialog open={open} onClose={() => setOpen(false)} title={t('common.add')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={create}>{t('common.save')}</Button></>}><div className="space-y-4"><Input label={t('auth.username')} required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /><Input label={t('field.name')} required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /><Select label={t('field.role')} value={form.role} options={['admin', 'operateur', 'lecteur'].map((value) => ({ value, label: t(`role.${value}`) }))} onChange={(event) => setForm({ ...form, role: event.target.value })} /><Input label={t('auth.password')} type="password" required hint={t('profile.policy')} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div></Dialog></>;
}
