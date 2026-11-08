import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, FileBarChart, Map, PanelLeftClose, Plus, Settings, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Avatar, Button, IconButton } from '../ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Logo } from './Logo.jsx';

const navItems = [
  { to: '/', end: true, key: 'nav.dashboard', icon: BarChart3 },
  { to: '/anomalies', key: 'nav.anomalies', icon: PanelLeftClose },
  { to: '/carte', key: 'nav.map', icon: Map },
  { to: '/rapport', key: 'nav.report', icon: FileBarChart },
];

function storedCollapse() {
  try { return localStorage.getItem('anm-sidebar') === 'collapsed'; } catch { return false; }
}

export function Sidebar({ mobileOpen, onMobileClose }) {
  const { t, dir } = useI18n();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(storedCollapse);
  useEffect(() => { try { localStorage.setItem('anm-sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* stockage indisponible */ } }, [collapsed]);
  const items = user?.role === 'admin' ? [...navItems, { to: '/admin/referentiels', key: 'nav.admin', icon: Settings }] : navItems;
  return <aside className={`sidebar-pattern fixed inset-y-0 start-0 z-70 flex flex-col bg-gradient-to-b from-brand-950 to-brand-800 text-brand-50 transition-[width,transform] duration-200 md:sticky md:top-0 md:z-30 md:h-dvh ${collapsed ? 'md:w-20' : 'md:w-72'} w-72 ${mobileOpen ? 'translate-x-0' : dir === 'rtl' ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
    <div className="relative z-10 flex h-20 items-center justify-between border-b border-brand-700 px-4"><Logo compact={collapsed} /><IconButton className="text-brand-50 md:hidden" aria-label={t('nav.closeMenu')} onClick={onMobileClose}><X className="h-5 w-5" /></IconButton></div>
    <div className="relative z-10 px-3 pt-5"><Button className={`w-full ${collapsed ? 'px-0' : ''}`} onClick={onMobileClose} as="span"><NavLink to="/anomalies/nouvelle" className="flex w-full items-center justify-center gap-2"><Plus className="h-5 w-5 shrink-0" />{!collapsed && <span>{t('nav.new')}</span>}</NavLink></Button></div>
    <nav className="relative z-10 mt-5 flex-1 space-y-1 px-3">{items.map(({ to, key, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={onMobileClose} title={collapsed ? t(key) : undefined} className={({ isActive }) => `relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${isActive ? 'bg-brand-700 text-brand-50 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-gold-500' : 'text-brand-100 hover:bg-brand-800 hover:text-brand-50'}`}><Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{!collapsed && <span>{t(key)}</span>}</NavLink>)}</nav>
    <div className="relative z-10 border-t border-brand-700 p-3"><div className={`flex items-center gap-3 rounded-md p-2 ${collapsed ? 'justify-center' : ''}`}><Avatar name={user?.full_name} />{!collapsed && <div className="min-w-0"><p className="truncate text-sm font-bold text-brand-50">{user?.full_name}</p><p className="text-xs text-brand-100">{t(`role.${user?.role}`)}</p></div>}</div><IconButton className="mt-2 hidden w-full text-brand-100 hover:text-brand-50 md:grid" aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} onClick={() => setCollapsed((value) => !value)}>{collapsed ? dir === 'rtl' ? <ChevronLeft /> : <ChevronRight /> : <PanelLeftClose />}</IconButton></div>
  </aside>;
}
