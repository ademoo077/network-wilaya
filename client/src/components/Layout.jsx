import { useState } from 'react';
import { useI18n } from '../i18n';
import { Menu, LayoutDashboard, List, Map as MapIcon, Plus, FileText, Settings } from 'lucide-react';

const navItems = [
  { key: 'dashboard', label: 'Tableau de bord', Icon: LayoutDashboard },
  { key: 'anomalies', label: 'Anomalies', Icon: List },
  { key: 'map', label: 'Carte', Icon: MapIcon },
  { key: 'quick', label: 'Nouvelle anomalie', Icon: Plus, primary: true },
  { key: 'rapport', label: 'Rapport hebdomadaire', Icon: FileText },
  { key: 'admin', label: 'Administration', Icon: Settings },
];

export default function Layout({ user, onLogout, onNavigate, children }) {
  const { t, lang, setLang } = useI18n();
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };
  const isRtl = lang === 'ar';
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-40 w-64 transform transition-transform duration-200 bg-gradient-to-b from-[var(--brand-950)] to-[var(--brand-800)] text-white ${open ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0 md:static md:flex md:flex-col`}
        style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'><polygon points='60,10 110,60 60,110 10,60'/><polygon points='60,25 95,60 60,95 25,60'/><line x1='60' y1='10' x2='60' y2='110'/><line x1='10' y1='60' x2='110' y2='60'/></g></svg>\")" }}
      >
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold-500)]/20 border border-[var(--gold-500)]/40 flex items-center justify-center text-[var(--gold-500)] font-bold">W</div>
            <div>
              <div className="font-bold text-sm leading-tight">Wilaya d'Alger</div>
              <div className="text-xs text-white/60 leading-tight">Cellule technique de numérisation</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-md)] text-sm transition-colors ${item.primary ? 'bg-[var(--gold-500)] text-[var(--brand-950)] font-semibold hover:bg-[var(--gold-500)]/90' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
            >
              <item.Icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
          {user?.username} · {user?.role}
        </div>
      </aside>
      {open && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />}
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <button className="md:hidden p-2" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <div className="flex-1" />
          <button onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')} className="text-sm px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--brand-50)]">
            {lang === 'ar' ? 'FR' : 'العربية'}
          </button>
          <button onClick={toggleDark} className="text-sm px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--brand-50)]">
            {dark ? '☀' : '☾'}
          </button>
          <button onClick={onLogout} className="text-sm text-[var(--st-non)] hover:underline">{t('logout')}</button>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-[1480px] mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}