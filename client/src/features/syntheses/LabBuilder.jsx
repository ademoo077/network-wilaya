import {
  CalendarRange, ChevronDown, Filter, Layers, Play, Plus, Ruler, SlidersHorizontal, Trash2,
} from 'lucide-react';
import { CATALOGUE, measureCompatible } from '@anm/shared';
import {
  Alert, Button, Card, Checkbox, Combobox, IconButton, Input, Select,
} from '../../components/ui/index.js';
import {
  MAX_DIMENSIONS, MAX_MESURES, catalogueLabel, createFilterDraft, filterInitialValue,
} from './labHelpers.js';

function BuilderSection({ icon: Icon, title, action, children }) {
  return <section className="p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Icon className="h-4 w-4 text-brand-700" aria-hidden="true" />{title}</h3>
      {action}
    </div>
    {children}
  </section>;
}

function FilterValueEditor({ config, filter, index, onChange, t }) {
  const label = t('lab.valueN', { index });
  const selected = Array.isArray(filter.value) ? filter.value[0] ?? '' : filter.value;

  if (filter.op === 'is_null') {
    return <Select label={label} value={filter.value ? 'true' : 'false'} onChange={(event) => onChange(event.target.value === 'true')}
      options={[{ value: 'true', label: t('lab.nullAbsent') }, { value: 'false', label: t('lab.nullPresent') }]} />;
  }
  if (filter.op === 'between') {
    const values = Array.isArray(filter.value) ? filter.value : ['', ''];
    return <div className="grid gap-2 sm:grid-cols-2">
      <Input type="date" label={t('lab.filterStartN', { index })} value={values[0] || ''}
        onChange={(event) => onChange([event.target.value, values[1] || ''])} />
      <Input type="date" label={t('lab.filterEndN', { index })} value={values[1] || ''}
        onChange={(event) => onChange([values[0] || '', event.target.value])} />
    </div>;
  }
  if (config.valueType === 'bool') {
    return <Select label={label} value={filter.value ? 'true' : 'false'} onChange={(event) => onChange(event.target.value === 'true')}
      options={[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]} />;
  }
  if (config.valueType === 'date') {
    return <Input type="date" label={label} value={filter.value || ''} onChange={(event) => onChange(event.target.value)} />;
  }
  if (config.valueType === 'text') {
    return <Input label={label} maxLength={200} value={filter.value || ''} onChange={(event) => onChange(event.target.value)} />;
  }

  const setChoice = (value) => onChange(filter.op === 'in' || filter.op === 'not_in' ? [value] : value);
  const choice = Array.isArray(selected) ? selected[0] ?? '' : selected;
  if (config.options.length) {
    return <Combobox label={label} options={config.options} value={choice} onChange={setChoice} />;
  }
  return <Input label={label} type={config.valueType === 'id' ? 'number' : 'text'} min={config.valueType === 'id' ? 1 : undefined}
    inputMode={config.valueType === 'id' ? 'numeric' : undefined} value={choice || ''}
    hint={config.valueType === 'id' ? t('lab.idHint') : undefined}
    onChange={(event) => onChange(filter.op === 'in' || filter.op === 'not_in' ? [event.target.value] : event.target.value)} />;
}

export default function LabBuilder({
  draft, onChange, filterConfigs, catalogueVersion, running, dirty, hasResult, validation, onRun, t, lang,
}) {
  const update = (patch) => onChange((current) => (typeof patch === 'function' ? patch(current) : { ...current, ...patch }));
  const usedMeasures = new Set(draft.mesures.map((mesure) => mesure.id));
  const selectedDimensionIds = new Set(draft.dimensions.map((dimension) => dimension.champ));

  const measureOptions = Object.values(CATALOGUE.mesures).map((mesure) => ({
    value: mesure.id,
    label: catalogueLabel(mesure, lang),
    description: lang === 'ar' ? mesure.description_ar : mesure.description_fr,
    disabled: !draft.dimensions.every((dimension) => measureCompatible(mesure.id, dimension.champ)),
  }));
  const nextMeasure = Object.values(CATALOGUE.mesures).find((mesure) => {
    if (usedMeasures.has(mesure.id)) return false;
    return draft.dimensions.every((dimension) => measureCompatible(mesure.id, dimension.champ));
  });

  const dimensionOptions = Object.values(CATALOGUE.dimensions).map((dimension) => ({
    value: dimension.id,
    label: catalogueLabel(dimension, lang),
    disabled: (selectedDimensionIds.has(dimension.id) && !draft.dimensions.some((item) => item.champ === dimension.id))
      || !draft.mesures.every((mesure) => measureCompatible(mesure.id, dimension.id)),
  }));
  const nextDimension = Object.values(CATALOGUE.dimensions).find((dimension) => {
    if (selectedDimensionIds.has(dimension.id)) return false;
    return draft.mesures.every((mesure) => measureCompatible(mesure.id, dimension.id));
  });

  const updateMeasure = (index, patch) => update((current) => ({
    ...current,
    mesures: current.mesures.map((mesure, position) => (position === index ? { ...mesure, ...patch } : mesure)),
  }));
  const addMeasure = () => {
    if (!nextMeasure) return;
    update((current) => ({ ...current, mesures: [...current.mesures, { id: nextMeasure.id }] }));
  };
  const updateDimension = (index, patch) => update((current) => ({
    ...current,
    dimensions: current.dimensions.map((dimension, position) => (position === index ? { ...dimension, ...patch } : dimension)),
  }));
  const addDimension = () => {
    if (!nextDimension) return;
    update((current) => ({
      ...current,
      dimensions: [...current.dimensions, {
        champ: nextDimension.id,
        granularite: nextDimension.kind === 'time' ? 'jour' : undefined,
      }],
    }));
  };
  const updateFilter = (index, patch) => update((current) => ({
    ...current,
    filtres: current.filtres.map((filtre, position) => (position === index ? { ...filtre, ...patch } : filtre)),
  }));
  const addFilter = () => {
    const config = filterConfigs.find((item) => item.id === 'statut') || filterConfigs[0];
    if (!config) return;
    update((current) => ({ ...current, filtres: [...current.filtres, createFilterDraft(config.id)] }));
  };

  const setPeriodMode = (mode) => update((current) => ({
    ...current,
    periode: {
      ...current.periode,
      mode,
      jours: current.periode.jours || 30,
      debut: current.periode.debut,
      fin: current.periode.fin,
    },
  }));

  return <Card data-testid="lab-builder">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-ink"><bdi>{t('lab.builder')}</bdi></h2>
        <p className="mt-1 text-sm text-muted">{t('lab.builderHelp')}</p>
      </div>
      <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-ink2">
        {t('lab.catalogueVersion', { version: catalogueVersion })}
      </span>
    </div>

    <div className="divide-y divide-border">
      <BuilderSection icon={Layers} title={t('lab.measures')} action={
        <Button size="sm" variant="ghost" onClick={addMeasure} disabled={running || draft.mesures.length >= MAX_MESURES || !nextMeasure} data-testid="lab-add-measure">
          <Plus className="h-4 w-4" aria-hidden="true" />{t('lab.addMeasure')}
        </Button>
      }>
        <div className="grid gap-2">
          {draft.mesures.map((mesure, index) => {
            const otherMeasures = new Set(draft.mesures.filter((_, position) => position !== index).map((item) => item.id));
            const options = measureOptions.map((option) => ({
              ...option,
              disabled: otherMeasures.has(option.value) || option.disabled,
            }));
            return <div key={`${mesure.id}-${index}`} className="flex items-end gap-2">
              <Combobox className="min-w-0 flex-1" label={t('lab.measureN', { index: index + 1 })} options={options}
                value={mesure.id} disabled={running}
                onChange={(value) => updateMeasure(index, { id: value, alias: '', format: '' })} />
              <IconButton aria-label={t('lab.removeMeasure', { index: index + 1 })} disabled={draft.mesures.length === 1 || running}
                onClick={() => update((current) => ({ ...current, mesures: current.mesures.filter((_, position) => position !== index) }))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>;
          })}
        </div>
        {draft.mesures.length >= MAX_MESURES && <p className="mt-2 text-xs text-muted">{t('lab.maxMeasures')}</p>}
      </BuilderSection>

      <BuilderSection icon={Ruler} title={t('lab.dimensions')} action={
        <Button size="sm" variant="ghost" onClick={addDimension} disabled={running || draft.dimensions.length >= MAX_DIMENSIONS || !nextDimension} data-testid="lab-add-dimension">
          <Plus className="h-4 w-4" aria-hidden="true" />{t('lab.addDimension')}
        </Button>
      }>
        {draft.dimensions.length === 0
          ? <p className="text-sm text-muted">{t('lab.noDimensions')}</p>
          : <div className="grid gap-2">
            {draft.dimensions.map((dimension, index) => {
              const meta = CATALOGUE.dimensions[dimension.champ];
              const options = dimensionOptions.map((option) => ({
                ...option,
                disabled: option.value === dimension.champ ? false : option.disabled,
              }));
              return <div key={`${dimension.champ}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                <Select label={t('lab.dimensionN', { index: index + 1 })} value={dimension.champ} disabled={running}
                  data-testid={`lab-dimension-${index + 1}`}
                  options={options} onChange={(event) => {
                    const next = CATALOGUE.dimensions[event.target.value];
                    updateDimension(index, {
                      champ: event.target.value,
                      granularite: next?.kind === 'time' ? 'jour' : undefined,
                    });
                  }} />
                {meta?.kind === 'time' && <Select label={t('lab.granularityN', { index: index + 1 })} value={dimension.granularite || 'jour'}
                  disabled={running} options={(meta.granularites || []).map((id) => ({ value: id, label: catalogueLabel(CATALOGUE.granularites[id], lang) }))}
                  onChange={(event) => updateDimension(index, { granularite: event.target.value })} />}
                <div className="flex items-end">
                  <IconButton aria-label={t('lab.removeDimension', { index: index + 1 })} disabled={running}
                    onClick={() => update((current) => ({ ...current, dimensions: current.dimensions.filter((_, position) => position !== index) }))}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </div>
              </div>;
            })}
          </div>}
        {draft.dimensions.length >= MAX_DIMENSIONS && <p className="mt-2 text-xs text-muted">{t('lab.maxDimensions')}</p>}
      </BuilderSection>

      <BuilderSection icon={Filter} title={t('lab.filters')} action={
        <Button size="sm" variant="ghost" onClick={addFilter} disabled={running || !filterConfigs.length} data-testid="lab-add-filter">
          <Plus className="h-4 w-4" aria-hidden="true" />{t('lab.addFilter')}
        </Button>
      }>
        {draft.filtres.length === 0
          ? <p className="text-sm text-muted">{t('lab.noFilters')}</p>
          : <div className="grid gap-2">
            {draft.filtres.map((filtre, index) => {
              const config = filterConfigs.find((item) => item.id === filtre.champ) || filterConfigs[0];
              if (!config) return null;
              return <div key={`${filtre.champ}-${index}`} className="rounded-md border border-border p-2.5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Select label={t('lab.filterN', { index: index + 1 })} value={filtre.champ} disabled={running}
                    options={filterConfigs.map((item) => ({ value: item.id, label: item.label }))}
                    onChange={(event) => updateFilter(index, createFilterDraft(event.target.value))} />
                  <div className="flex items-end">
                    <IconButton aria-label={t('lab.removeFilter', { index: index + 1 })} disabled={running}
                      onClick={() => update((current) => ({ ...current, filtres: current.filtres.filter((_, position) => position !== index) }))}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Select label={t('lab.operatorN', { index: index + 1 })} value={filtre.op} disabled={running}
                    options={config.ops.map((op) => ({ value: op, label: catalogueLabel(CATALOGUE.ops[op], lang) }))}
                    onChange={(event) => updateFilter(index, {
                      op: event.target.value,
                      value: filterInitialValue(config, event.target.value),
                    })} />
                  <FilterValueEditor config={config} filter={filtre} index={index + 1} t={t}
                    onChange={(value) => updateFilter(index, { value })} />
                </div>
              </div>;
            })}
          </div>}
      </BuilderSection>

      <BuilderSection icon={CalendarRange} title={t('lab.period')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t('lab.period')} value={draft.periode.mode} disabled={running}
            options={[
              { value: 'semaine', label: t('lab.periodWeek') },
              { value: 'mois', label: t('lab.periodMonth') },
              { value: 'glissant', label: t('lab.periodGliding') },
              { value: 'plage', label: t('lab.periodCustom') },
            ]}
            onChange={(event) => setPeriodMode(event.target.value)} />
          {draft.periode.mode === 'glissant' && <Input type="number" inputMode="numeric" min="1" max="3660"
            label={t('lab.periodDays')} value={draft.periode.jours ?? ''} disabled={running}
            onChange={(event) => update((current) => ({ ...current, periode: { ...current.periode, jours: event.target.value } }))} />}
        </div>
        {draft.periode.mode === 'plage' && <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input type="date" label={t('lab.periodStart')} value={draft.periode.debut || ''} disabled={running}
            onChange={(event) => update((current) => ({ ...current, periode: { ...current.periode, debut: event.target.value } }))} />
          <Input type="date" label={t('lab.periodEnd')} value={draft.periode.fin || ''} disabled={running}
            onChange={(event) => update((current) => ({ ...current, periode: { ...current.periode, fin: event.target.value } }))} />
        </div>}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Select label={t('lab.comparison')} value={draft.comparaison} disabled={running}
            options={[
              { value: 'aucune', label: t('lab.comparisonNone') },
              { value: 'periode_precedente', label: t('lab.comparisonPrevious') },
              { value: 'meme_periode_n-1', label: t('lab.comparisonN1') },
              { value: 'moyenne_4', label: t('lab.comparisonAverage4') },
              { value: 'periode_libre', label: t('lab.comparisonCustom') },
            ]}
            onChange={(event) => update({ comparaison: event.target.value })} />
          <Select label={t('lab.statusMode')} value={draft.statut_mode} disabled={running}
            options={[{ value: 'actuel', label: t('lab.statusModeCurrent') }, { value: 'fin_periode', label: t('lab.statusModeEnd') }]}
            onChange={(event) => update({ statut_mode: event.target.value })} />
        </div>
        {draft.comparaison === 'periode_libre' && <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input type="date" label={t('lab.comparisonStart')} value={draft.comparaison_debut || ''} disabled={running}
            onChange={(event) => update({ comparaison_debut: event.target.value })} />
          <Input type="date" label={t('lab.comparisonEnd')} value={draft.comparaison_fin || ''} disabled={running}
            onChange={(event) => update({ comparaison_fin: event.target.value })} />
        </div>}
      </BuilderSection>

      <section className="p-4">
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-bold text-ink"><SlidersHorizontal className="h-4 w-4 text-brand-700" aria-hidden="true" />{t('lab.advanced')}</span>
            <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input type="number" inputMode="numeric" min="1" max="5000" label={t('lab.limit')} hint={t('lab.limitHint')}
              placeholder={t('lab.limitPlaceholder')} value={draft.limite ?? ''} disabled={running}
              onChange={(event) => update({ limite: event.target.value })} />
            <div className="grid content-start gap-1">
              <Checkbox label={t('lab.totals')} checked={draft.totaux} disabled={running}
                onChange={(event) => update({ totaux: event.target.checked })} />
              <Checkbox label={t('lab.groupOthers')} checked={draft.regrouper_autres} disabled={running}
                onChange={(event) => update({ regrouper_autres: event.target.checked })} />
              <Checkbox label={t('lab.includeInfirmees')} checked={draft.inclure_infirmees} disabled={running}
                onChange={(event) => update({ inclure_infirmees: event.target.checked })} />
            </div>
          </div>
        </details>
      </section>
    </div>

    <div className="flex flex-col gap-3 border-t border-border p-4">
      {validation.length > 0 && <Alert variant="danger" title={t('lab.validationTitle')}>
        <ul className="list-inside list-disc space-y-1">{validation.map((message) => <li key={message}>{message}</li>)}</ul>
      </Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted" role="status">
          {running ? t('lab.evaluating') : dirty ? t('lab.dirty') : hasResult ? t('lab.upToDate') : t('lab.ready')}
        </p>
        <Button onClick={onRun} loading={running} data-testid="lab-evaluate"><Play className="h-4 w-4" aria-hidden="true" />{running ? t('lab.evaluating') : t('lab.evaluate')}</Button>
      </div>
    </div>
  </Card>;
}
