import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();
  const focusMain = (event) => {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  };
  return <div className="app-grid">
    <a href="#main-content" onClick={focusMain} className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-brand-700 focus:shadow-2">{t('nav.skipToContent')}</a>
    <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
    <div className="min-w-0"><Topbar onMenu={() => setMobileOpen(true)} /><main id="main-content" tabIndex={-1} className="min-w-0"><Outlet /></main></div>
  </div>;
}
