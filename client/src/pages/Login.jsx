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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">{t('loginTitle')}</h1>
        <p className="text-center text-gray-500 dark:text-gray-400">{t('loginSubtitle')}</p>
        {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">{t('username')}</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button type="submit" disabled={busy} className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50">
          {busy ? '...' : t('submit')}
        </button>
      </form>
    </div>
  );
}
