import { addDays, todayAlgiers, weekStart, STATUTS, PRIORITES } from '@anm/shared';
import { Button, Checkbox, Input, Select } from '../../components/ui/index.js';
import StatusLegend from '../../components/ui/StatusLegend.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { refOptions } from '../anomalies/helpers.js';

export default function MapFilters({ filters, setFilter, reset, refs, density, setDensity }) {
  const { t, lang } = useI18n();
  const daira = refs.dairas.find((item) => String(item.id) === filters.daira);
  const domain = refs.domaines.find((item) => String(item.id) === filters.domaine);
  const from = weekStart(todayAlgiers(), Number(refs.parametres.week_start_day) || 0); const to = addDays(from, 6);
  const weekOnly = filters.from === from && filters.to === to;
  return <div className="space-y-3 p-4">
    <Input id="map-search" type="search" label={t('map.search')} placeholder={t('map.searchHelp')} value={filters.q || ''} onChange={(event) => setFilter('q', event.target.value)} />
    <div className="grid grid-cols-2 gap-3">
      <Select id="map-daira" label={t('field.daira')} placeholder={t('common.all')} value={filters.daira || ''} options={refOptions(refs.dairas, lang, { includeInactive: true })} onChange={(event) => setFilter('daira', event.target.value, { commune: '' })} />
      <Select id="map-commune" label={t('field.commune')} placeholder={t('common.all')} value={filters.commune || ''} disabled={!daira} options={refOptions(daira?.communes || [], lang, { includeInactive: true })} onChange={(event) => setFilter('commune', event.target.value)} />
      <Select id="map-status" label={t('field.status')} placeholder={t('common.all')} value={filters.statut || ''} options={STATUTS.map((value) => ({ value, label: t(`status.${value}`) }))} onChange={(event) => setFilter('statut', event.target.value)} />
      <Select id="map-priority" label={t('field.priority')} placeholder={t('common.all')} value={filters.priorite || ''} options={PRIORITES.map((value) => ({ value, label: t(`priority.${value}`) }))} onChange={(event) => setFilter('priorite', event.target.value)} />
    </div>
    <details open={Boolean(filters.domaine || filters.type)}><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t('form.classification')}</summary>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Select id="map-domain" label={t('field.category')} placeholder={t('common.all')} value={filters.domaine || ''} options={refOptions(refs.domaines, lang, { includeInactive: true })} onChange={(event) => setFilter('domaine', event.target.value, { type: '' })} />
        <Select id="map-type" label={t('field.type')} placeholder={t('common.all')} value={filters.type || ''} disabled={!domain} options={refOptions(domain?.types || [], lang, { includeInactive: true })} onChange={(event) => setFilter('type', event.target.value)} />
      </div>
    </details>
    <div className="flex flex-wrap gap-x-4">
      <Checkbox label={t('dashboard.thisWeek')} checked={weekOnly} onChange={(event) => setFilter('from', event.target.checked ? from : '', { to: event.target.checked ? to : '' })} />
      <Checkbox label={t('map.density')} checked={density} onChange={(event) => setDensity(event.target.checked)} />
    </div>
    <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t('map.period')}</summary>
      <div className="grid grid-cols-2 gap-3"><Input id="map-from" type="date" label={t('field.from')} value={filters.from || ''} onChange={(event) => setFilter('from', event.target.value)} />
        <Input id="map-to" type="date" label={t('field.to')} value={filters.to || ''} onChange={(event) => setFilter('to', event.target.value)} /></div>
      <Checkbox label={t('dashboard.includeDenied')} checked={filters.include_infirmees === '1'} onChange={(event) => setFilter('include_infirmees', event.target.checked ? '1' : '')} />
    </details>
    {Object.keys(filters).length > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={reset}>{t('map.resetFilters')}</Button>}
    <details open><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">{t('map.legend')}</summary><StatusLegend /></details>
  </div>;
}
