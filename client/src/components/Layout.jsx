import { useI18n } from '../i18n';

export default function Layout({ user, onLogout, children }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">{t('appName')}</div>
          <div className="text-xs text-gray-500">{t('tagline')}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user?.username}</span>
          <button onClick={onLogout} className="text-sm text-red-600 underline">
            {t('logout')}
          </button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
