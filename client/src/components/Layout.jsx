import { useState } from 'react';
import { useI18n } from '../i18n';
import { Menu, LayoutDashboard, List, Map as MapIcon, Plus, FileText, Settings, Search, LogOut, ChevronDown } from 'lucide-react';

const navItems = [
  { key: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
  { key: 'anomalies', label: 'Anomalies', Icon: List },
  { key: 'map', label: 'Carte', Icon: MapIcon },
  { key: 'rapport', label: 'Rapport hebdomadaire', Icon: FileText },
  { key: 'admin', label: 'Administration', Icon: Settings },
];

export default function Layout({ user, onLogout, onNavigate, currentView, children }) {
  const { t, lang, setLang } = useI18n();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };
  const isRtl = lang === 'ar';
  const initials = (user?.full_name || user?.username || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside
        className={`fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-40 w-64 transform transition-transform duration-200 bg-gradient-to-b from-[var(--brand-950)] to-[var(--brand-800)] text-white ${open ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0 md:static md:flex md:flex-col overflow-hidden`}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><g fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='1'><polygon points='40,6 74,40 40,74 6,40'/><polygon points='40,6 74,40 40,74 6,40' transform='rotate(45 40 40)'/></g></svg>\")", maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.9) 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.9) 100%)' }} />
        <div className="relative px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-500)]/20 border border-[var(--gold-500)]/40 flex items-center justify-center text-[var(--gold-500)] font-bold">W</div>
            <div>
              <div className="font-bold text-sm leading-tight">Wilaya d'Alger</div>
              <div className="text-xs text-white/60 leading-tight">Cellule technique de numérisation</div>
            </div>
          </div>
        </div>
        <nav className="relative flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); setOpen(false); }}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] text-sm transition-colors ${active ? 'bg-white/15 text-white font-semibold border-s-2 border-[var(--gold-500)]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
              >
                <item.Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="relative px-5 py-4 border-t border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--gold-500)]/30 flex items-center justify-center text-xs font-bold">{initials}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.full_name || user?.username}</div>
            <div className="text-xs text-white/60 truncate">{user?.role}</div>
          </div>
        </div>
        <div className="relative px-3 pb-4">
          <button onClick={() => onNavigate('quick')} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--r-md)] text-sm font-semibold bg-[var(--gold-500)] text-[var(--brand-950)] hover:bg-[var(--gold-500)]/90">
            <Plus size={18} /> Nouvelle anomalie
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)] px-4 md:px-6 py-3 flex items-center justify-between gap-3 min-w-0">
          <button className="md:hidden p-2" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <div className="hidden md:flex items-center gap-2 text-sm text-[var(--muted)] min-w-0">
            <span>Accueil</span><span>/</span><span className="text-[var(--ink)] truncate">{currentView}</span>
          </div>
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input placeholder="Recherche globale (touche /)" className="h-9 w-full ps-9 pe-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]/40" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')} title="Langue" aria-label="Langue" className="text-sm px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--brand-50)]">
              {lang === 'ar' ? 'FR' : 'العربية'}
            </button>
            <button onClick={toggleDark} title="Thème" aria-label="Thème" className="text-sm px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--brand-50)]">
              {dark ? '☀' : '☾'}
            </button>
            <div className="relative">
              <button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--r-md)] hover:bg-[var(--brand-50)]" aria-label="Menu utilisateur">
                <div className="w-8 h-8 rounded-full bg-[var(--brand-600)] text-white flex items-center justify-center text-xs font-bold">{initials}</div>
                <ChevronDown size={14} />
              </button>
              {userMenu && (
                <div className="absolute end-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] shadow-[var(--shadow-2)] py-1 z-30">
                  <div className="px-3 py-2 border-b border-[var(--border)]">
                    <div className="text-sm font-medium text-[var(--ink)]">{user?.full_name || user?.username}</div>
                    <div className="text-xs text-[var(--muted)]">{user?.role}</div>
                  </div>
                  <button className="w-full text-start px-3 py-2 text-sm text-[var(--ink-2)] hover:bg-[var(--brand-50)]">Changer le mot de passe</button>
                  <button onClick={onLogout} className="w-full text-start px-3 py-2 text-sm text-[var(--st-non)] hover:bg-[var(--st-non-bg)] flex items-center gap-2"><LogOut size={14} /> {t('logout')}</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}