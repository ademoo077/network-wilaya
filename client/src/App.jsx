import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { LoadingBlock } from './components/ui/index.js';
import AppShell from './components/layout/AppShell.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useRefs } from './context/RefsContext.jsx';

const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const ProfilePage = lazy(() => import('./features/auth/ProfilePage.jsx'));
const SetupPage = lazy(() => import('./features/setup/SetupPage.jsx'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage.jsx'));
const AnomaliesPage = lazy(() => import('./features/anomalies/AnomaliesPage.jsx'));
const AnomalyFormPage = lazy(() => import('./features/anomalies/AnomalyFormPage.jsx'));
const AnomalyDetailPage = lazy(() => import('./features/anomalies/AnomalyDetailPage.jsx'));
const MapPage = lazy(() => import('./features/map/MapPage.jsx'));
const ReportPage = lazy(() => import('./features/report/ReportPage.jsx'));
const AdminPage = lazy(() => import('./features/admin/AdminPage.jsx'));
const NotFoundPage = lazy(() => import('./features/NotFoundPage.jsx'));

function Protected() {
  const { user, loading } = useAuth();
  const { setup, loading: refsLoading } = useRefs();
  const location = useLocation();
  if (loading || (user && refsLoading && !setup)) return <div className="page-container"><LoadingBlock /></div>;
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
  return <HashRouter><Suspense fallback={<Fallback />}><Routes><Route path="/connexion" element={<LoginPage />} /><Route element={<Protected />}><Route element={<AppShell />}><Route index element={<DashboardPage />} /><Route path="anomalies" element={<AnomaliesPage />} /><Route path="anomalies/nouvelle" element={<AnomalyFormPage />} /><Route path="anomalies/:id" element={<AnomalyDetailPage />} /><Route path="anomalies/:id/modifier" element={<AnomalyFormPage />} /><Route path="carte" element={<MapPage />} /><Route path="rapport" element={<ReportPage />} /><Route path="profil" element={<ProfilePage />} /><Route element={<AdminOnly />}><Route path="assistant" element={<SetupPage />} /><Route path="admin/:onglet" element={<AdminPage />} /></Route><Route path="*" element={<NotFoundPage />} /></Route></Route></Routes></Suspense></HashRouter>;
}
