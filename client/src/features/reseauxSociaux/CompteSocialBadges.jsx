import { CircleHelp, FileText, Radio, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

export const SOCIAL_ICONS = { page: FileText, profil: UserRound, groupe: UsersRound, chaine: Radio, autre: CircleHelp };
export function CompteSocialType({ value }) {
  const { t } = useI18n(); const Icon = SOCIAL_ICONS[value] || CircleHelp;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t(`social.type.${value}`)}
  </span>;
}
export function CompteSocialEtat({ item }) {
  const { t } = useI18n(); const verified = item.verification === 'verifie'; const Icon = verified ? ShieldCheck : CircleHelp;
  return <div className="flex flex-wrap items-center gap-1.5">
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-straitebg text-straite' : 'bg-stcoursbg text-stcours'}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t(`social.verification.${item.verification}`)}
    </span>
    {!item.actif && <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">{t('social.inactive')}</span>}
  </div>;
}
export function socialLocationLabel(item, kind, lang) {
  return (lang === 'ar' ? item[`${kind}_ar`] || item[`${kind}_fr`] : item[`${kind}_fr`] || item[`${kind}_ar`])
    || item[kind === 'ca' ? 'ca_libelle' : 'commune_libelle'] || '—';
}
