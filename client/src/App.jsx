import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { apiFetch } from './api';
import Login from './pages/Login';
import Layout from './components/Layout';
import AnomaliesList from './pages/AnomaliesList';
import AnomalyQuickCreate from './pages/AnomalyQuickCreate';
import Dashboard from './pages/Dashboard';
import Rapport from './pages/Rapport';
import Map from './pages/Map';
import Admin from './pages/Admin';
import Detail from './pages/Detail';

function Shell() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [anomaliesFilters, setAnomaliesFilters] = useState({ page: 1, pageSize: 25 });
  const [detailId, setDetailId] = useState(null);

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

  const handleDrillDown = (filters) => {
    setAnomaliesFilters({ ...filters, page: 1 });
    setView('anomalies');
  };

  return (
    <Layout
      user={user}
      onLogout={() => {
        setUser(null);
        setView('dashboard');
      }}
      onNavigate={setView}
    >
      {view === 'anomalies' ? (
        <AnomaliesList onOpen={(id) => { setDetailId(id); setView('detail'); }} filters={anomaliesFilters} setFilters={setAnomaliesFilters} />
      ) : view === 'quick' ? (
        <AnomalyQuickCreate onCreated={() => {}} />
      ) : view === 'rapport' ? (
        <Rapport />
      ) : view === 'map' ? (
        <Map />
      ) : view === 'admin' ? (
        <Admin />
      ) : view === 'detail' ? (
        <Detail id={detailId} onBack={() => setView('anomalies')} />
      ) : (
        <Dashboard onDrillDown={handleDrillDown} />
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
