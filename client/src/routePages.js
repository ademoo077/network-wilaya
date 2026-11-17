import { lazyWithRetry } from './utils/lazyWithRetry.js';

export const LoginPage = lazyWithRetry(() => import('./features/auth/LoginPage.jsx'));
export const ProfilePage = lazyWithRetry(() => import('./features/auth/ProfilePage.jsx'));
export const SetupPage = lazyWithRetry(() => import('./features/setup/SetupPage.jsx'));
export const DashboardPage = lazyWithRetry(() => import('./features/dashboard/DashboardPage.jsx'));
export const AnomaliesPage = lazyWithRetry(() => import('./features/anomalies/AnomaliesPage.jsx'));
export const AnomalyFormPage = lazyWithRetry(() => import('./features/anomalies/AnomalyFormPage.jsx'));
export const AnomalyDetailPage = lazyWithRetry(() => import('./features/anomalies/AnomalyDetailPage.jsx'));
export const MapPage = lazyWithRetry(() => import('./features/map/MapPage.jsx'));
export const ReportPage = lazyWithRetry(() => import('./features/report/ReportPage.jsx'));
export const WorkPage = lazyWithRetry(() => import('./features/work/WorkPage.jsx'));
export const ReseauxSociauxPage = lazyWithRetry(() => import('./features/reseauxSociaux/ReseauxSociauxPage.jsx'));
export const LaboratoirePage = lazyWithRetry(() => import('./features/syntheses/LaboratoirePage.jsx'));
export const SynthesesPage = lazyWithRetry(() => import('./features/syntheses/SynthesesPage.jsx'));
export const SynthesePage = lazyWithRetry(() => import('./features/syntheses/SynthesePage.jsx'));
export const VeillePage = lazyWithRetry(() => import('./features/veille/VeillePage.jsx'));
export const VeilleDashboardPage = lazyWithRetry(() => import('./features/veille/VeilleDashboardPage.jsx'));
export const VeilleCompliancePage = lazyWithRetry(() => import('./features/veille/VeilleCompliancePage.jsx'));
export const VeilleDetailPage = lazyWithRetry(() => import('./features/veille/VeilleDetailPage.jsx'));
export const VeilleSettingsPage = lazyWithRetry(() => import('./features/veille/VeilleSettingsPage.jsx'));
export const AdminPage = lazyWithRetry(() => import('./features/admin/AdminPage.jsx'));
export const NotFoundPage = lazyWithRetry(() => import('./features/NotFoundPage.jsx'));

export function preloadRoute(path) {
  const pages = { '/': DashboardPage, '/anomalies': AnomaliesPage, '/anomalies/nouvelle': AnomalyFormPage,
    '/carte': MapPage, '/rapport': ReportPage, '/a-faire': WorkPage, '/profil': ProfilePage, '/admin/referentiels': AdminPage,
    '/laboratoire': LaboratoirePage, '/reseaux-sociaux': ReseauxSociauxPage, '/reseaux': ReseauxSociauxPage, '/admin/reseaux-sociaux': AdminPage,
    '/veille': VeillePage, '/veille/tableau': VeilleDashboardPage, '/veille/conformite': VeilleCompliancePage,
    '/veille/reglages': VeilleSettingsPage, '/syntheses': SynthesesPage };
    pages[path]?.preload();
}
