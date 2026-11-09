import { lazy, Suspense, useState } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { LoadingBlock } from './components/ui/index.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import FatalError from './features/errors/FatalError.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useRefs } from './context/RefsContext.jsx';
import { useI18n } from './i18n/index.jsx';

async function retryLoad(loader, attempts = 1) {
  try {
    return await loader();
  } catch (error) {
    const retryable = error?.name === 'ChunkLoadError';
    if (retryable && attempts > 0) {
      await new Promise((resolve) => {
        const handler = () => { window.removeEventListener('vite:preloadError', handler); resolve(); };
        window.addEventListener('vite:preloadError', handler, { once: true });
        window.setTimeout(() => { window.removeEventListener('vite:preloadError', handler); resolve(); }, 1500);
      });
      return retryLoad(loader, attempts - 1);
    }
    throw error;
  }
}

const withRetry = (loader) => lazy(() => retryLoad(loader, 1));

const LoginPage = withRetry(() => import('./features/auth/LoginPage.jsx'));
const ProfilePage = withRetry(() => import('./features/auth/ProfilePage.jsx'));
const SetupPage = withRetry(() => import('./features/setup/SetupPage.jsx'));
const DashboardPage = withRetry(() => import('./features/dashboard/DashboardPage.jsx'));
const AnomaliesPage = withRetry(() => import('./features/anomalies/AnomaliesPage.jsx'));
const AnomalyFormPage = withRetry(() => import('./features/anomalies/AnomalyFormPage.jsx'));
const AnomalyDetailPage = withRetry(() => import('./features/anomalies/AnomalyDetailPage.jsx'));
const MapPage = withRetry(() => import('./features/map/MapPage.jsx'));
const ReportPage = withRetry(() => import('./features/report/ReportPage.jsx'));
const AdminPage = withRetry(() => import('./features/admin/AdminPage.jsx'));
const NotFoundPage = withRetry(() => import('./features/NotFoundPage.jsx'));

function BootScreen() {
  const { t } = useI18n();
  return (
  <div className="page-container grid min-h-screen place-items-center gap-6">
    <div className="flex flex-col items-center gap-3">
      <span className="grid h-14 w-14 place-items-center rounded-xl bg-brand-700 text-xl font-black text-brand-50">{t('app.wilaya').charAt(0)}</span>
      <h1 className="text-lg font-black text-ink">{t('app.title')}</h1>
    </div>
    <div className="h-1 w-64 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={40}>
      <div className="h-full w-2/5 animate-pulse rounded-full bg-brand-700" />
    </div>
  </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  const { setup, loading: refsLoading } = useRefs();
  const location = useLocation();
  if (loading || (user && refsLoading && !setup)) return <BootScreen />;
  if (!user) return <Navigate to="/connexion" state={{ from: `${location.pathname}${location.search}` }} replace />;
  if (user.must_change_password && location.pathname !== '/profil') return <Navigate to="/profil" replace />;
  // Premier démarrage : l'assistant reste accessible, sans bloquer la navigation.
  // (rediriger ici empêchait de fermer/découvrir les autres onglets)
  return <Outlet />;
}

function AdminOnly() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}

function Fallback() { return <div className="page-container"><LoadingBlock /></div>; }

export default function App() {
  const { user, loading: authLoading, reset: resetAuth } = useAuth();
  const { setup, loading: refsLoading } = useRefs();
  const [fatal, setFatal] = useState(null);
  const phase = fatal ? 'fatal' : authLoading ? 'authChecking' : user ? (refsLoading && !setup ? 'refsLoading' : 'ready') : 'ready';

  if (phase === 'fatal') {
    return <FatalError error={fatal} onRetry={() => { setFatal(null); resetAuth(); }} />;
  }
  if (phase === 'authChecking' || phase === 'refsLoading') {
    return <BootScreen />;
  }

  return (
    <HashRouter>
      <ErrorBoundary>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/connexion" element={<LoginPage />} />
            <Route element={<Protected />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="anomalies" element={<ErrorBoundary><AnomaliesPage /></ErrorBoundary>} />
                <Route path="anomalies/nouvelle" element={<ErrorBoundary><AnomalyFormPage /></ErrorBoundary>} />
                <Route path="anomalies/:id" element={<ErrorBoundary><AnomalyDetailPage /></ErrorBoundary>} />
                <Route path="anomalies/:id/modifier" element={<ErrorBoundary><AnomalyFormPage /></ErrorBoundary>} />
                <Route path="carte" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
                <Route path="rapport" element={<ErrorBoundary><ReportPage /></ErrorBoundary>} />
                <Route path="profil" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
                <Route element={<AdminOnly />}>
                  <Route path="assistant" element={<ErrorBoundary><SetupPage /></ErrorBoundary>} />
                  <Route path="admin/:onglet" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
