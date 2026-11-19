import { PLATEFORMES, PRIORITES, STATUTS } from '@anm/shared';
import { Card, Checkbox, Combobox, Input, Select } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';

export default function AnomalyFilters({ filters, setFilter, refs }) {
  const { t, lang } = useI18n();
  const domain = refs.domaines.find((item) => String(item.id) === String(filters.domaine));
  const daira = refs.dairas.find((item) => String(item.id) === String(filters.daira));
  const enums = [['statut', 'field.status', STATUTS, 'status'],
    ['plateforme', 'field.platform', PLATEFORMES, 'platform'], ['priorite', 'field.priority', PRIORITES, 'priority']];
  const referenceFields = [['domaine', 'field.category', refs.domaines], ['type', 'field.type', domain?.types ?? []],
    ['daira', 'field.daira', refs.dairas], ['commune', 'field.commune', daira?.communes ?? []],
    ['epic', 'field.epic', refs.epics], ['agent', 'field.agent', refs.agents]];
  return <Card className="mb-5 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
    <Input className="sm:col-span-2" type="search" label={t('common.search')} value={filters.q || ''} onChange={(event) => setFilter('q', event.target.value)} />
    {enums.map(([key, label, values, prefix]) => <Select key={key} label={t(label)} placeholder={t('common.all')} value={filters[key] || ''}
      options={values.map((value) => ({ value, label: t(`${prefix}.${value}`) }))}
      onChange={(event) => setFilter(key, event.target.value)} />)}
    {referenceFields.map(([key, label, items]) => <Combobox key={key} label={t(label)} placeholder={t('common.all')} value={filters[key] || ''}
      options={refOptions(items, lang)} onChange={(value) => setFilter(key, value, key === 'domaine' ? { type: '' } : key === 'daira' ? { commune: '' } : {})} />)}
    <Select label={t('field.gps')} placeholder={t('common.all')} value={filters.gps || ''}
      options={['absent', 'present'].map((value) => ({ value, label: t(`gps.${value}`) }))} onChange={(event) => setFilter('gps', event.target.value)} />
    <Input type="date" label={t('field.from')} value={filters.from || ''} onChange={(event) => setFilter('from', event.target.value)} />
    <Input type="date" label={t('field.to')} value={filters.to || ''} onChange={(event) => setFilter('to', event.target.value)} />
    <Checkbox label={t('dashboard.includeDenied')} checked={filters.include_infirmees === '1'} onChange={(event) => setFilter('include_infirmees', event.target.checked ? 1 : '')} />
  </div></Card>;
}
