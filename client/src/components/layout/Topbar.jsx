import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Moon, Plus, Search, Sun, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, queryString } from '../../api/client.js';
import { Avatar, Breadcrumbs, Button, IconButton, Tooltip } from '../ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function breadcrumbItems(pathname, t) {
  if (pathname === '/') return [{ label: t('nav.dashboard') }];
  if (pathname.startsWith('/anomalies/nouvelle')) return [{ label: t('nav.anomalies'), to: '/anomalies' }, { label: t('form.newTitle') }];
  if (pathname.startsWith('/anomalies/')) return [{ label: t('nav.anomalies'), to: '/anomalies' }, { label: t('detail.title') }];
  if (pathname.startsWith('/anomalies')) return [{ label: t('nav.anomalies') }];
  if (pathname.startsWith('/carte')) return [{ label: t('nav.map') }];
  if (pathname.startsWith('/rapport')) return [{ label: t('nav.report') }];
  if (pathname.startsWith('/admin')) return [{ label: t('nav.admin') }];
  if (pathname.startsWith('/assistant')) return [{ label: t('setup.title') }];
  if (pathname.startsWith('/profil')) return [{ label: t('nav.profile') }];
  return [{ label: t('notFound.title') }];
}

export function Topbar({ onMenu }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [userOpen, setUserOpen] = useState(false);
  useEffect(() => {
    const handler = (event) => {
      const input = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (event.key === '/' && !input) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key.toLowerCase() === 'n' && !input) navigate('/anomalies/nouvelle');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return undefined; }
    const timer = window.setTimeout(() => api(`/anomalies${queryString({ q: query, pageSize: 6 })}`).then((data) => setResults(data.items)).catch(() => setResults([])), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const submitSearch = (event) => { event.preventDefault(); if (query.trim()) { navigate(`/anomalies?${new URLSearchParams({ q: query.trim() })}`); setResults([]); } };
  return <header role="banner" className="sticky top-0 z-50 flex h-16 items-center gap-3 border-b border-border bg-[var(--glass)] px-4 backdrop-blur-md md:px-6"><IconButton className="md:hidden" aria-label={t('nav.openMenu')} onClick={onMenu}><Menu className="h-5 w-5" /></IconButton><div className="hidden min-w-0 flex-1 lg:block"><Breadcrumbs items={breadcrumbItems(location.pathname, t)} /></div><form className="relative min-w-0 flex-1 lg:max-w-xl" onSubmit={submitSearch}><Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('nav.globalSearch')} aria-label={t('nav.globalSearch')} className="h-11 w-full rounded-md border border-border bg-surface ps-10 pe-12 text-sm text-ink placeholder:text-muted" /><kbd className="pointer-events-none absolute end-3 top-3 rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted">/</kbd>{results.length > 0 && <div className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-md border border-border bg-surface shadow-2">{results.map((item) => <Link key={item.id} to={`/anomalies/${item.id}`} onClick={() => { setResults([]); setQuery(''); }} className="block border-b border-border px-3 py-2 text-sm hover:bg-surface2"><bdi className="font-bold text-brand-700">{item.reference}</bdi><p className="truncate text-xs text-muted">{item.type_fr || item.type_ar} · {item.adresse_texte || item.commune_fr}</p></Link>)}</div>}</form><Button className="hidden xl:inline-flex" size="sm" onClick={() => navigate('/anomalies/nouvelle')}><Plus className="h-4 w-4" />{t('nav.new')}</Button><Tooltip content={t('nav.language')}><IconButton aria-label={t('nav.language')} onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}><span className="text-xs font-black">{lang === 'fr' ? 'AR' : 'FR'}</span></IconButton></Tooltip><Tooltip content={t('nav.theme')}><IconButton aria-label={t('nav.theme')} onClick={toggleTheme}>{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</IconButton></Tooltip><div className="relative"><IconButton aria-label={t('nav.userMenu')} aria-expanded={userOpen} onClick={() => setUserOpen((value) => !value)}><Avatar name={user?.full_name} size="sm" /></IconButton>{userOpen && <div className="absolute end-0 top-full mt-2 w-64 rounded-md border border-border bg-surface p-2 shadow-2"><div className="border-b border-border px-3 py-2"><p className="truncate text-sm font-bold">{user?.full_name}</p><p className="text-xs text-muted">{t(`role.${user?.role}`)}</p></div><Link to="/profil" onClick={() => setUserOpen(false)} className="mt-1 flex min-h-10 items-center gap-2 rounded-sm px-3 text-sm hover:bg-surface2"><UserRound className="h-4 w-4" />{t('nav.profile')}</Link><button className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 text-sm text-danger hover:bg-surface2" onClick={async () => { setUserOpen(false); await logout(); navigate('/connexion'); }}><LogOut className="h-4 w-4" />{t('auth.logout')}</button></div>}</div></header>;
}
