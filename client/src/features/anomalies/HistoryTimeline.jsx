import { useMemo, useState } from 'react';
import { CalendarDays, FileText, Flag, MapPin, ShieldCheck, Tag, UserRound, Camera, Link2 } from 'lucide-react';
import { formatDateTime, grouperHistorique, HISTORIQUE_TYPE_LABELS, HISTORIQUE_TYPES, tempsRelatif } from '@anm/shared';
import { EmptyState, Select } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

const ICONES = {
  creation: FileText, statut: ShieldCheck, date: CalendarDays, source: Link2,
  localisation: MapPin, agent: UserRound, details: Tag, photo: Camera, priorite: Flag,
};

function initiales(nom, lang) {
  const propre = String(nom || '?').replace(/^\[[^\]]+\]\s*/, '').trim();
  if (!propre) return '?';
  return propre.split(/\s+/).slice(0, 2).map((mot) => mot[0]).join('').toLocaleUpperCase(lang === 'ar' ? 'ar' : 'fr-FR');
}

function Ligne({ evenement }) {
  const Icone = ICONES[evenement.type] || FileText;
  const { avant, apres } = evenement;
  return <li className="flex gap-3 py-2">
    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
      <Icone className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold">{evenement.titre}</p>
      {(avant || apres) && <p className="mt-0.5 text-xs text-ink2">
        {avant && <bdi className="text-muted">{avant}</bdi>}
        {avant && apres && <span aria-hidden="true"> → </span>}
        {apres && <bdi className="font-semibold">{apres}</bdi>}
      </p>}
      {evenement.motif && <blockquote className="mt-1 border-s-2 border-border ps-2 text-xs italic text-muted">
        <bdi>« {evenement.motif} »</bdi>
      </blockquote>}
    </div>
  </li>;
}

export default function HistoryTimeline({ entries }) {
  const { t, lang } = useI18n();
  const [filtre, setFiltre] = useState('tous');
  const groupes = useMemo(() => grouperHistorique(entries, lang, t), [entries, lang, t]);
  const visibles = useMemo(() => groupes.map((groupe) => ({
    ...groupe, evenements: groupe.evenements.filter((evenement) => filtre === 'tous' || evenement.type === filtre),
  })).filter((groupe) => groupe.evenements.length), [groupes, filtre]);
  if (!entries?.length) return <EmptyState title={t('detail.noHistory')} compact />;
  const options = [{ value: 'tous', label: t('history.all') }, ...HISTORIQUE_TYPES.map((type) => ({
    value: type, label: HISTORIQUE_TYPE_LABELS[type][lang] || HISTORIQUE_TYPE_LABELS[type].fr,
  }))];
  return <div data-history-timeline>
    <div className="border-b border-border px-5 py-3">
      <Select data-history-filter aria-label={t('history.filter')} value={filtre} onChange={(event) => setFiltre(event.target.value)} options={options} />
    </div>
    {!visibles.length ? <EmptyState title={t('history.noMatch')} compact /> : <ol className="px-5 py-3">
      {visibles.map((groupe, index) => <li key={`${groupe.minute}-${index}`} className="border-b border-border pb-3 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span data-history-avatar aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-800 text-[11px] font-bold text-brand-50">
              {initiales(groupe.auteur, lang)}
            </span>
            <p className="truncate text-[11px] font-bold text-muted"><bdi>{groupe.auteur || '—'}</bdi></p>
          </div>
          <time className="text-[11px] text-muted" dateTime={groupe.at} title={formatDateTime(groupe.at)}>
            <bdi data-history-relative>{tempsRelatif(groupe.at, Date.now(), lang)}</bdi>
            <span className="ms-1">· {formatDateTime(groupe.at)}</span>
          </time>
        </div>
        <ul className="divide-y divide-border">{groupe.evenements.map((evenement, position) => <Ligne key={position} evenement={evenement} />)}</ul>
      </li>)}
    </ol>}
  </div>;
}
