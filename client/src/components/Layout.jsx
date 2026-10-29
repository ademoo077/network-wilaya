import { useState } from 'react';
import { useI18n } from '../i18n';

export default function Layout({ user, onLogout, onNavigate, children }) {
  const { t } = useI18n();
  const [dark, setDark] = useState(false);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-bold text-lg">{t('appName')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('tagline')}</div>
          </div>
          <nav className="flex gap-2">
            <button onClick={() => onNavigate('dashboard')} className="text-sm underline text-gray-700 dark:text-gray-200">Dashboard</button>
            <button onClick={() => onNavigate('anomalies')} className="text-sm underline text-gray-700 dark:text-gray-200">Anomalies</button>
            <button onClick={() => onNavigate('map')} className="text-sm underline text-gray-700 dark:text-gray-200">Carte</button>
            <button onClick={() => onNavigate('quick')} className="text-sm underline text-gray-700 dark:text-gray-200">{t('nouvelleAnomalie')}</button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-300">{user?.username}</span>
          <button onClick={toggleDark} className="text-sm underline text-gray-600 dark:text-gray-300">{dark ? 'Mode clair' : 'Mode sombre'}</button>
          <button onClick={onLogout} className="text-sm text-red-600 underline">
            {t('logout')}
          </button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
