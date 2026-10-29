import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { apiFetch } from './api';
import Login from './pages/Login';
import Layout from './components/Layout';
import AnomaliesList from './pages/AnomaliesList';
import AnomalyQuickCreate from './pages/AnomalyQuickCreate';

function Shell() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/auth/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">{t('loading')}</div>
    );
  }
  if (!user) {
    return <Login onSuccess={setUser} />;
  }

  return (
    <Layout
      user={user}
      onLogout={() => {
        setUser(null);
        setView('dashboard');
      }}
      onNavigate={setView}
    >
      {view === 'anomalies' ? <AnomaliesList onOpen={() => {}} /> : view === 'quick' ? <AnomalyQuickCreate onCreated={() => {}} /> : (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold">{t('appName')}</h2>
          <p className="text-gray-500 mt-2">Phase 1 - Socle en place. Les modules fonctionnels arrivent Phase 2.</p>
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
