import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="app-grid"><Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />{mobileOpen && <button className="fixed inset-0 z-60 bg-[var(--overlay)] md:hidden" aria-label="×" onClick={() => setMobileOpen(false)} />}<div className="min-w-0"><Topbar onMenu={() => setMobileOpen(true)} /><main className="min-w-0"><Outlet /></main></div></div>;
}
