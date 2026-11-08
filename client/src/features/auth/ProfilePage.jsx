import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { Alert, Button, Card, Input, useToast } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';

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
  return <div className="page-container"><PageHeader title={t('profile.title')} description={user?.full_name} />{user?.must_change_password ? <Alert variant="warning" className="mb-5">{t('profile.policy')}</Alert> : null}<Card className="max-w-2xl p-5 sm:p-6"><div className="mb-5 grid h-12 w-12 place-items-center rounded-lg bg-brand-100 text-brand-800"><KeyRound /></div>{errors.form && <Alert variant="danger" className="mb-4">{errors.form}</Alert>}<form className="space-y-4" onSubmit={submit}><Input label={t('profile.current')} type="password" autoComplete="current-password" required value={form.current} error={errors.current} onChange={(event) => setForm({ ...form, current: event.target.value })} /><Input label={t('profile.new')} type="password" autoComplete="new-password" required hint={t('profile.policy')} value={form.next} error={errors.next} onChange={(event) => setForm({ ...form, next: event.target.value })} /><Input label={t('profile.confirmNew')} type="password" autoComplete="new-password" required value={form.confirm} error={errors.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} /><div className="flex justify-end"><Button type="submit" loading={loading}>{t('common.save')}</Button></div></form></Card></div>;
}
