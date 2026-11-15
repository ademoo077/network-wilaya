import { useState } from 'react';
import { Copy, KeyRound, PlugZap, ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '@anm/shared';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, EmptyState, Input, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useI18n } from '../../i18n/index.jsx';

function CaptureTokens() {
  const { t } = useI18n(); const { user } = useAuth(); const { push } = useToast();
  const canCreate = user.role !== 'lecteur';
  const tokens = useApiQuery('/veille/capture-tokens');
  const [name, setName] = useState(''); const [created, setCreated] = useState(null); const [busy, setBusy] = useState(false);
  const items = tokens.data?.items || [];
  const create = async (event) => {
    event.preventDefault();
    if (!canCreate || name.trim().length < 2) return;
    setBusy(true);
    try {
      const result = await api('/veille/capture-tokens', { method: 'POST', body: { nom: name.trim() } });
      setCreated(result.token); setName(''); push(t('veille.capture.created'), 'success'); await tokens.refetch();
    } catch (error) { push(error.message, 'danger'); } finally { setBusy(false); }
  };
  const revoke = async (id) => {
    try { await api(`/veille/capture-tokens/${id}`, { method: 'DELETE' }); push(t('veille.capture.revoked'), 'success'); await tokens.refetch(); }
    catch (error) { push(error.message, 'danger'); }
  };
  const copy = async () => {
    if (!created) return;
    try { await navigator.clipboard.writeText(created); push(t('veille.capture.copy'), 'success'); }
    catch { push(created, 'info'); }
  };
  return <Card className="mt-5 max-w-2xl p-5 sm:p-6">
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-800"><PlugZap /></div>
      <div><h2 className="font-bold text-ink">{t('veille.capture.title')}</h2><p className="mt-1 text-sm text-muted">{t('veille.capture.help')}</p></div>
    </div>
    {created && <Alert variant="success" className="mb-4" title={t('veille.capture.created')} action={<Button size="sm" variant="secondary" onClick={copy}><Copy className="h-4 w-4" aria-hidden="true" />{t('veille.capture.copy')}</Button>}><code className="block break-all rounded-sm bg-surface2 px-2 py-1 text-xs text-ink">{created}</code></Alert>}
    {canCreate && <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={create}>
      <Input className="min-w-56 flex-1" label={t('veille.capture.name')} value={name} onChange={(event) => setName(event.target.value)} required />
      <Button type="submit" loading={busy} disabled={name.trim().length < 2}>{t('veille.capture.create')}</Button>
    </form>}
    {items.length ? <ul className="grid gap-2">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <div className="min-w-0"><p className="font-semibold text-ink"><bdi>{item.nom}</bdi></p>
        <p className="text-xs text-muted">{item.revoque ? t('veille.capture.revokedState') : t('veille.capture.active')} · {t('veille.capture.lastUse')}: {item.derniere_utilisation ? formatDateTime(item.derniere_utilisation) : '—'}</p></div>
      {!item.revoque && <Button size="sm" variant="ghost" onClick={() => revoke(item.id)}><ShieldX className="h-4 w-4" aria-hidden="true" />{t('veille.capture.revoke')}</Button>}
    </li>)}</ul> : <EmptyState compact icon={PlugZap} title={t('veille.capture.empty')} />}
  </Card>;
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (form.next !== form.confirm) { setErrors({ confirm: t('profile.confirmNew') }); return; }
    setLoading(true);
    setErrors({});
    try {
      await api('/auth/change-password', { method: 'POST', body: { current: form.current, next: form.next } });
      push(t('profile.changed'));
      await logout().catch(() => null);
      navigate('/connexion', { replace: true });
    } catch (error) {
      setErrors(error.fields || { form: error.message });
    } finally { setLoading(false); }
  };
  return <div className="page-container"><PageHeader title={t('profile.title')} description={user?.full_name} />{user?.must_change_password ? <Alert variant="warning" className="mb-5">{t('profile.policy')}</Alert> : null}<Card className="max-w-2xl p-5 sm:p-6"><div className="mb-5 grid h-12 w-12 place-items-center rounded-lg bg-brand-100 text-brand-800"><KeyRound /></div>{errors.form && <Alert variant="danger" className="mb-4">{errors.form}</Alert>}<form className="space-y-4" onSubmit={submit}><Input label={t('profile.current')} type="password" autoComplete="current-password" required value={form.current} error={errors.current} onChange={(event) => setForm({ ...form, current: event.target.value })} /><Input label={t('profile.new')} type="password" autoComplete="new-password" required hint={t('profile.policy')} value={form.next} error={errors.next} onChange={(event) => setForm({ ...form, next: event.target.value })} /><Input label={t('profile.confirmNew')} type="password" autoComplete="new-password" required value={form.confirm} error={errors.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} /><div className="flex justify-end"><Button type="submit" loading={loading}>{t('common.save')}</Button></div></form></Card><CaptureTokens /></div>;
}
