import { useI18n } from '../../i18n/index.jsx';

export function Logo({ compact = false }) {
  const { t } = useI18n();
  return <div className="flex items-center gap-3"><svg className="h-10 w-10 shrink-0 text-gold-500" viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="12" y="12" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="2" /><rect x="12" y="12" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="2" transform="rotate(45 24 24)" /><circle cx="24" cy="24" r="5" fill="currentColor" /></svg>{!compact && <div className="min-w-0"><p className="text-sm font-black text-brand-50">{t('app.wilaya')}</p><p className="mt-0.5 text-[11px] leading-tight text-brand-100">{t('app.cell')}</p></div>}</div>;
}
