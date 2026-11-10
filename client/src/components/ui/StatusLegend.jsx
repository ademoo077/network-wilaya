import { STATUTS } from '@anm/shared';
import { useI18n } from '../../i18n/index.jsx';

export const statusColors = { non_traite: 'bg-stnon', en_cours: 'bg-stcours', traite: 'bg-straite' };
export default function StatusLegend() {
  const { t } = useI18n();
  return <ul data-status-legend className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink2">
    {STATUTS.map((status) => <li key={status} className="flex items-center gap-2"><span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-sm ${statusColors[status]}`} />{t(`status.${status}`)}</li>)}
  </ul>;
}
