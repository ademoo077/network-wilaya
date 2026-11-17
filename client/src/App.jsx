import { Suspense } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LoadingBlock } from './components/ui/index.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import FatalError from './features/errors/FatalError.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useRefs } from './context/RefsContext.jsx';
import { useI18n } from './i18n/index.jsx';
import { LoginPage, ProfilePage, SetupPage, DashboardPage, AnomaliesPage, AnomalyFormPage,
  AnomalyDetailPage, MapPage, ReportPage, WorkPage, LaboratoirePage, AdminPage, NotFoundPage,
  VeillePage, VeilleDashboardPage, VeilleCompliancePage, VeilleDetailPage, VeilleSettingsPage,
  SynthesesPage, SynthesePage, ReseauxSociauxPage } from './routePages.js';

export function BootScreen() {
  const { t } = useI18n();
  return <main data-boot aria-busy="true" className="page-container grid min-h-dvh content-center justify-items-center gap-6">
    <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-xl bg-brand-700 text-xl font-black text-brand-50">W</span>
    <h1 className="text-center text-lg font-black">{t('app.title')}</h1>
    <div className="h-1 w-64 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label={t('common.loading')}>
      <div className="h-full w-2/5 animate-pulse rounded-full bg-brand-700" />
    </div><p className="text-sm text-muted">{t('common.loading')}</p>
  </main>;
}

function Protected() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (user.must_change_password && location.pathname !== '/profil') return <Navigate to="/profil" replace />;
  return <Outlet />;
}
function AdminOnly() { return useAuth().user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />; }
function RoutePage({ page: Page }) {
  const location = useLocation();
  const { id } = useParams();
  const Content = id && !/^[1-9]\d*$/.test(id) ? NotFoundPage : Page;
  return <ErrorBoundary key={location.pathname}><Suspense fallback={<div className="page-container" aria-busy="true"><LoadingBlock /></div>}><Content /></Suspense></ErrorBoundary>;
}
const page = (Page) => <RoutePage page={Page} />;
function Application() {
  const auth = useAuth();
  const refs = useRefs();
  const error = auth.error || refs.error;
  const phase = error ? 'fatal' : auth.loading ? 'authChecking' : !auth.user ? 'anonymous' : !refs.ready ? 'refLoading' : 'ready';
  if (phase === 'fatal') return <FatalError error={error} onRetry={() => auth.error ? auth.reset() : refs.reload()} />;
  if (['authChecking', 'refLoading'].includes(phase)) return <BootScreen />;
  return <Routes>
    <Route path="/connexion" element={page(LoginPage)} />
    <Route element={<Protected />}><Route element={<AppShell />}>
      <Route index element={page(DashboardPage)} />
      <Route path="anomalies" element={page(AnomaliesPage)} />
      <Route path="anomalies/nouvelle" element={page(AnomalyFormPage)} />
      <Route path="anomalies/:id" element={page(AnomalyDetailPage)} />
      <Route path="anomalies/:id/modifier" element={page(AnomalyFormPage)} />
      <Route path="carte" element={page(MapPage)} />
      <Route path="a-faire" element={page(WorkPage)} />
      <Route path="reseaux-sociaux" element={page(ReseauxSociauxPage)} />
      <Route path="reseaux" element={page(ReseauxSociauxPage)} />
      <Route path="laboratoire" element={page(LaboratoirePage)} />
      <Route path="veille" element={page(VeillePage)} />
      <Route path="veille/tableau" element={page(VeilleDashboardPage)} />
      <Route path="veille/elements/:id" element={page(VeilleDetailPage)} />
      <Route element={<AdminOnly />}><Route path="veille/reglages" element={page(VeilleSettingsPage)} /><Route path="veille/conformite" element={page(VeilleCompliancePage)} /></Route>
      <Route path="rapport" element={page(ReportPage)} />
      <Route path="syntheses" element={page(SynthesesPage)} />
      <Route path="syntheses/:id" element={page(SynthesePage)} />
      <Route path="profil" element={page(ProfilePage)} />
      <Route element={<AdminOnly />}><Route path="assistant" element={page(SetupPage)} /><Route path="admin/:onglet" element={page(AdminPage)} /></Route>
      <Route path="*" element={page(NotFoundPage)} />
    </Route></Route>
  </Routes>;
}
export default function App() { return <HashRouter><Application /></HashRouter>; }
