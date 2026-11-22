import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Database, LayoutGrid, ListTodo, Map, PanelLeftClose, Plus, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Avatar, Button, Drawer, IconButton } from '../ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { preloadRoute } from '../../routePages.js';
import { Logo } from './Logo.jsx';

const navItems = [
  { to: '/', end: true, key: 'nav.dashboard', icon: BarChart3 },
  { to: '/anomalies', key: 'nav.anomalies', icon: PanelLeftClose },
  { to: '/carte', key: 'nav.map', icon: Map },
  { to: '/a-faire', key: 'nav.work', icon: ListTodo },
  { to: '/reseaux-sociaux', key: 'nav.socialDirectory', icon: Database },
  { to: '/rapport', key: 'nav.syntheses', icon: LayoutGrid },
];
const adminNavItems = [
  { to: '/admin/referentiels', key: 'nav.admin', icon: Settings },
];
const SIDEBAR_VISIBILITY_KEY = 'anm-sidebar-items';
function storedCollapse() { try { return localStorage.getItem('anm-sidebar') === 'collapsed'; } catch { return false; } }
function defaultVisibility() {
  const out = {};
  for (const item of [...navItems, ...adminNavItems]) out[item.key] = true;
  return out;
}
function storedVisibility() {
  try {
    const raw = localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
    if (!raw) return defaultVisibility();
    return { ...defaultVisibility(), ...JSON.parse(raw) };
  } catch { return defaultVisibility(); }
}
export function Sidebar({ mobileOpen, onMobileClose }) {
  const { t, dir } = useI18n(); const { user } = useAuth(); const desktop = useMediaQuery('(min-width: 1024px)');
  const [collapsed, setCollapsed] = useState(storedCollapse); const compact = collapsed && desktop;
  const [visibility, setVisibility] = useState(storedVisibility);
  useEffect(() => { try { localStorage.setItem('anm-sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* stockage indisponible */ } }, [collapsed]);
  useEffect(() => { try { localStorage.setItem(SIDEBAR_VISIBILITY_KEY, JSON.stringify(visibility)); } catch { /* stockage indisponible */ } }, [visibility]);
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === SIDEBAR_VISIBILITY_KEY) {
        try { setVisibility({ ...defaultVisibility(), ...JSON.parse(event.newValue || '{}') }); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => { if (desktop && mobileOpen) onMobileClose(); }, [desktop, mobileOpen, onMobileClose]);
  const allItems = user?.role === 'admin' ? [...navItems, ...adminNavItems] : navItems;
  const items = allItems.filter((item) => visibility[item.key] !== false);
  const content = <div className="relative z-10 flex h-full flex-col">
    <div className="flex h-20 shrink-0 items-center border-b border-brand-700 px-4"><Logo compact={compact} /></div>
    {user?.role !== 'lecteur' && <div className="px-3 pt-5"><Button as={NavLink} to="/anomalies/nouvelle" className="w-full" aria-label={t('nav.new')}
      onClick={onMobileClose} onMouseEnter={() => preloadRoute('/anomalies/nouvelle')} onFocus={() => preloadRoute('/anomalies/nouvelle')}>
      <Plus className="h-5 w-5 shrink-0" />{!compact && t('nav.new')}</Button></div>}
    <nav aria-label={t('nav.menu')} className="mt-5 flex-1 space-y-1 overflow-y-auto px-3">{items.map(({ to, key, icon: Icon, end }) => <NavLink key={to} to={to} end={end}
      onClick={onMobileClose} onMouseEnter={() => preloadRoute(to)} onFocus={() => preloadRoute(to)} aria-label={t(key)} title={compact ? t(key) : undefined}
      className={({ isActive }) => `relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${isActive ? 'bg-brand-700 text-brand-50 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-gold-500' : 'text-brand-100 hover:bg-brand-800 hover:text-brand-50'}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{!compact && <span>{t(key)}</span>}</NavLink>)}</nav>
    <div className="border-t border-brand-700 p-3"><div className={`flex items-center gap-3 rounded-md p-2 ${compact ? 'justify-center' : ''}`}><Avatar name={user?.full_name} />
      {!compact && <div className="min-w-0"><p className="truncate text-sm font-bold text-brand-50">{user?.full_name}</p><p className="text-xs text-brand-100">{t(`role.${user?.role}`)}</p></div>}</div>
      {desktop && <IconButton className="mt-2 w-full text-brand-100 hover:text-brand-50" aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? dir === 'rtl' ? <ChevronLeft /> : <ChevronRight /> : <PanelLeftClose />}</IconButton>}</div>
  </div>;
  if (!desktop) return <Drawer open={mobileOpen} onClose={onMobileClose} title={t('nav.menu')} width="max-w-xs" side="start"><div className="-m-5 min-h-full bg-gradient-to-b from-brand-950 to-brand-800 text-brand-50">{content}</div></Drawer>;
  return <aside className={`sidebar-pattern sticky top-0 z-30 h-dvh border-e border-brand-800 bg-gradient-to-b from-brand-950 to-brand-800 text-brand-50 transition-[width] duration-200 ${collapsed ? 'w-20' : 'w-72'}`}>{content}</aside>;
}
