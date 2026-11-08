import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, IconButton, Input } from '../../components/ui/index.js';
import { Logo } from '../../components/layout/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';

export default function LoginPage() {
  const { t } = useI18n();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to={user.must_change_password ? '/profil' : '/'} replace />;
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const connected = await login(form.username, form.password);
      const fallback = connected.must_change_password ? '/profil' : '/';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (requestError) {
      setError(requestError.message || t('auth.invalid'));
    } finally {
      setLoading(false);
    }
  };
  return <main className="grid min-h-dvh bg-bg lg:grid-cols-2"><section className="sidebar-pattern hidden flex-col justify-between bg-gradient-to-br from-brand-950 to-brand-700 p-12 lg:flex"><Logo /><div className="relative z-10 max-w-xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-gold-500">{t('app.wilaya')}</p><h1 className="mt-4 text-4xl font-black leading-tight text-brand-50">{t('app.title')}</h1><p className="mt-4 text-base leading-relaxed text-brand-100">{t('auth.welcome')}</p></div><p className="relative z-10 text-xs text-brand-100">{t('app.cell')}</p></section><section className="grid place-items-center p-5"><div className="w-full max-w-md"><div className="mb-8 lg:hidden"><Logo /></div><div className="rounded-xl border border-border bg-surface p-6 shadow-2 sm:p-8"><div className="grid h-12 w-12 place-items-center rounded-lg bg-brand-100 text-brand-800"><LockKeyhole className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-black text-ink">{t('auth.login')}</h2><p className="mt-2 text-sm text-muted">{t('auth.welcome')}</p>{error && <Alert variant="danger" className="mt-5">{error}</Alert>}<form className="mt-6 space-y-4" onSubmit={submit}><div className="relative"><UserRound className="pointer-events-none absolute end-3 top-9 h-4 w-4 text-muted" /><Input label={t('auth.username')} autoComplete="username" required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></div><div className="relative"><Input label={t('auth.password')} type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><IconButton className="absolute end-1 top-7" aria-label={show ? t('common.close') : t('common.open')} onClick={() => setShow((value) => !value)}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</IconButton></div><Button type="submit" loading={loading} className="w-full">{t('auth.signIn')}</Button></form></div></div></section></main>;
}
