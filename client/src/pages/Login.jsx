import { useState } from 'react';
import { useI18n } from '../i18n';
import { apiFetch } from '../api';

export default function Login({ onSuccess }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });
      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-[var(--brand-950)] to-[var(--brand-800)] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='white' stroke-width='1'><polygon points='60,10 110,60 60,110 10,60'/><polygon points='60,25 95,60 60,95 25,60'/></g></svg>\")" }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-[var(--gold-500)]/20 border border-[var(--gold-500)]/40 flex items-center justify-center text-[var(--gold-500)] font-bold text-2xl mb-6">W</div>
          <h1 className="text-3xl font-bold leading-tight">Wilaya d'Alger</h1>
          <p className="text-white/70 mt-2">Cellule technique de numérisation</p>
        </div>
        <div className="relative text-sm text-white/60">
          Plateforme de suivi des anomalies (points noirs) sur les réseaux sociaux.
        </div>
      </div>
      <div className="flex items-center justify-center p-6 bg-[var(--bg)]">
        <form onSubmit={handleSubmit} className="w-full max-w-md bg-[var(--surface)] rounded-[var(--r-xl)] shadow-[var(--shadow-3)] border border-[var(--border)] p-8 space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-[var(--ink)]">{t('loginTitle')}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{t('loginSubtitle')}</p>
          </div>
          {error && <div className="p-3 bg-[var(--st-non-bg)] text-[var(--st-non)] rounded-[var(--r-md)] text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--ink-2)]">{t('username')}</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/40" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--ink-2)]">{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/40" />
          </div>
          <button type="submit" disabled={busy} className="w-full h-11 rounded-[var(--r-md)] bg-[var(--brand-600)] text-white font-medium hover:bg-[var(--brand-700)] disabled:opacity-50 transition-colors">
            {busy ? '…' : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}