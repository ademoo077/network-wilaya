import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Menu, Moon, Plus, Search, Sun, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { queryString } from '../../api/client.js';
import { Avatar, Breadcrumbs, Button, IconButton, Tooltip } from '../ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';

function breadcrumbItems(pathname, t) {
  if (pathname === '/') return [{ label: t('nav.dashboard') }];
  if (pathname.startsWith('/anomalies/nouvelle')) return [{ label: t('nav.anomalies'), to: '/anomalies' }, { label: t('form.newTitle') }];
  if (pathname.startsWith('/anomalies/')) return [{ label: t('nav.anomalies'), to: '/anomalies' }, { label: t('detail.title') }];
  const names = { anomalies: 'nav.anomalies', carte: 'nav.map', rapport: 'nav.syntheses', syntheses: 'nav.syntheses', 'a-faire': 'nav.work', 'reseaux-sociaux': 'nav.socialDirectory', reseaux: 'nav.socialDirectory', laboratoire: 'nav.lab', admin: 'nav.admin', assistant: 'setup.title', profil: 'nav.profile', reception: 'nav.inbox' };
  return [{ label: t(names[pathname.split('/')[1]] || 'notFound.title') }];
}
export function Topbar({ onMenu }) {
  const { t, lang, setLang } = useI18n(); const { theme, toggleTheme } = useTheme(); const { user, logout } = useAuth();
  const location = useLocation(); const navigate = useNavigate(); const searchRef = useRef(null); const menuRef = useRef(null); const bellRef = useRef(null);
  const [query, setQuery] = useState(''); const [searchOpen, setSearchOpen] = useState(false); const [userOpen, setUserOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const text = useDebounced(query.trim()); const action = useAsyncAction({ success: false });
  const search = useApiQuery(`/anomalies${queryString({ q: text, pageSize: 6 })}`, { enabled: text.length >= 2 && searchOpen });
  const work = useApiQuery('/work', { staleTime: 60_000 });
  const workItems = (work.data?.item?.items || []).filter((item) => item.count > 0).slice(0, 3);
  const workTotal = work.data?.item?.total || 0;
  useEffect(() => {
    const handler = (event) => {
      const input = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
      if ((event.key === '/' && !input) || event.key.toLowerCase() === 'k' && event.ctrlKey) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key.toLowerCase() === 'n' && !input && !event.ctrlKey && user.role !== 'lecteur') navigate('/anomalies/nouvelle');
      if (event.key === 'Escape') { setSearchOpen(false); setUserOpen(false); setAlertsOpen(false); }
    };
    const outside = (event) => { if (!menuRef.current?.contains(event.target)) setUserOpen(false);
      if (!bellRef.current?.contains(event.target)) setAlertsOpen(false); };
    document.addEventListener('keydown', handler); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', handler); document.removeEventListener('pointerdown', outside); };
  }, [navigate, user.role]);
  const submit = (event) => { event.preventDefault(); if (query.trim()) { navigate(`/anomalies${queryString({ q: query.trim() })}`); setSearchOpen(false); } };
  return <header role="banner" className="sticky top-0 z-50 flex h-16 min-w-0 items-center gap-2 border-b border-border bg-[var(--glass)] px-3 backdrop-blur-md md:gap-3 md:px-6">
    <IconButton className="lg:hidden" aria-label={t('nav.openMenu')} onClick={onMenu}><Menu className="h-5 w-5" /></IconButton>
    <div className="hidden min-w-0 flex-1 xl:block"><Breadcrumbs items={breadcrumbItems(location.pathname, t)} /></div>
    <form className="relative min-w-0 flex-1 xl:max-w-xl" onSubmit={submit}>
      <Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted" />
      <input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)}
        placeholder={t('nav.globalSearch')} aria-label={t('nav.globalSearch')} className="h-11 w-full rounded-md border border-border bg-surface ps-10 pe-2 text-sm text-ink placeholder:text-muted" />
      {searchOpen && text.length >= 2 && <div className="absolute start-0 top-full z-50 mt-1 max-h-80 w-[min(20rem,80vw)] overflow-auto rounded-md border border-border bg-surface p-2 shadow-2">
        {search.isFetching && <p role="status" className="p-2 text-sm text-muted">{t('common.loading')}</p>}
        {search.error ? <Button variant="ghost" onClick={() => search.refetch()}>{t('common.retry')}</Button> : (search.data?.items ?? []).map((item) => <Link key={item.id} to={`/anomalies/${item.id}`}
          onClick={() => { setSearchOpen(false); setQuery(''); }} className="block min-h-11 rounded-sm px-3 py-2 text-sm hover:bg-surface2"><bdi className="font-bold text-brand-700">{item.reference}</bdi>
          <p className="truncate text-xs text-muted">{lang === 'ar' ? item.type_ar || item.type_fr : item.type_fr || item.type_ar} · {item.adresse_texte || item.commune_fr}</p></Link>)}
        {!search.isFetching && !search.error && !search.data?.items?.length && <p className="p-2 text-sm text-muted">{t('common.noData')}</p>}
      </div>}
    </form>
    {user.role !== 'lecteur' && <Button className="hidden 2xl:inline-flex" size="sm" onClick={() => navigate('/anomalies/nouvelle')}><Plus className="h-4 w-4" />{t('nav.new')}</Button>}
    <div className="relative" ref={bellRef}>
      <Tooltip content={t('work.bell')}><IconButton className="relative" aria-expanded={alertsOpen}
        aria-label={workTotal > 0 ? `${t('work.bell')} — ${t('work.bellCount', { count: workTotal })}` : t('work.bell')}
        onClick={() => setAlertsOpen(!alertsOpen)}><Bell className="h-5 w-5" />
        {workTotal > 0 && <span aria-hidden="true" className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-surface">{workTotal > 99 ? '99+' : workTotal}</span>}
      </IconButton></Tooltip>
      {alertsOpen && <div className="absolute end-0 top-full z-50 mt-2 w-72 rounded-md border border-border bg-surface p-2 shadow-2">
        <p className="p-2 text-sm font-bold">{t('work.bell')}</p>
        {workItems.length ? <ul>{workItems.map((item) => <li key={item.id}>
          <Link to={`/anomalies${queryString({ ...item.filters, page: 1 })}`} onClick={() => setAlertsOpen(false)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-sm px-3 text-sm hover:bg-surface2">
            <span className="truncate">{t(item.label)}</span><bdi className="font-black tabular-nums">{item.count}</bdi></Link></li>)}</ul>
          : <p className="p-2 text-sm text-muted">{t('work.bellEmpty')}</p>}
        <Link to="/a-faire" onClick={() => setAlertsOpen(false)}
          className="flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold text-brand-700 hover:bg-surface2">{t('work.title')}</Link>
      </div>}
    </div>
    <Tooltip content={t('nav.language')}><IconButton aria-label={t('nav.language')} onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}><span className="text-xs font-black">{lang === 'fr' ? 'AR' : 'FR'}</span></IconButton></Tooltip>
    <Tooltip content={t('nav.theme')}><IconButton aria-label={t('nav.theme')} onClick={toggleTheme}>{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</IconButton></Tooltip>
    <div className="relative" ref={menuRef}><IconButton aria-label={t('nav.profile')} aria-expanded={userOpen} onClick={() => setUserOpen(!userOpen)}><Avatar name={user.full_name} /></IconButton>
      {userOpen && <div className="absolute end-0 top-full z-50 mt-2 w-60 rounded-md border border-border bg-surface p-2 shadow-2"><p className="truncate p-2 text-sm font-bold">{user.full_name}</p>
        <Link className="flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm hover:bg-surface2" to="/profil" onClick={() => setUserOpen(false)}><UserRound className="h-4 w-4" />{t('nav.profile')}</Link>
        <Button variant="ghost" className="w-full justify-start" loading={action.isPending} onClick={() => action.run(logout)}><LogOut className="h-4 w-4" />{t('nav.logout')}</Button>
      </div>}
    </div>
  </header>;
}
