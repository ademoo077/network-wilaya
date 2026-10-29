import { lazy, Suspense } from 'react';
import { useEffect, useState } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { apiFetch } from './api';

const Login = lazy(() => import('./pages/Login'));
const Layout = lazy(() => import('./components/Layout'));
const AnomaliesList = lazy(() => import('./pages/AnomaliesList'));
const AnomalyQuickCreate = lazy(() => import('./pages/AnomalyQuickCreate'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Rapport = lazy(() => import('./pages/Rapport'));
const Map = lazy(() => import('./pages/Map'));
const Admin = lazy(() => import('./pages/Admin'));
const Detail = lazy(() => import('./pages/Detail'));

function Shell() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => (window.location.hash.replace('#', '') || 'dashboard'));
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

  useEffect(() => {
    const handler = () => {
      const h = window.location.hash.replace('#', '') || 'dashboard';
      setView(h);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace('#', '') !== view) {
      window.location.hash = view;
    }
  }, [view]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">{t('loading')}</div>
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
      currentView={view}
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
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--ink)]">Chargement…</div>}>
        <Shell />
      </Suspense>
    </I18nProvider>
  );
}
