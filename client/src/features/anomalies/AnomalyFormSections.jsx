import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONTENU_TYPES, PLATEFORMES, PRIORITES, STATUTS, formNeedsReason, libelleExigences, libelleStatut, todayAlgiers } from '@anm/shared';
import { Card, CardHeader, Checkbox, Combobox, Input, Select, SegmentedControl, Textarea, Alert, Button } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';
import FormFeedback from './FormFeedback.jsx';
import InterventionField from './InterventionField.jsx';
import AgentAssignmentField from './AgentAssignmentField.jsx';
import PhotoAttachments from './PhotoAttachments.jsx';
import SourcePicker from './SourcePicker.jsx';

export function Section({ title, children, className = '' }) {
  return <Card className={className}><CardHeader title={title} /><div className="grid items-start gap-4 p-5 sm:grid-cols-2">{children}</div></Card>;
}
export function SourceSection({ model }) {
  const { t } = useI18n(); const { state, set, errors, paste, matches } = model; const form = state.values;
  return <Section title={t('form.source')}>
    <div className="sm:col-span-2"><Input id="lien_url" label={t('field.link')} placeholder={t('form.linkPlaceholder')} type="url" required
      value={form.lien_url} error={errors.lien_url} onChange={(event) => paste.input(event.target.value, 'lien_url')}
      onBlur={() => { if (form.lien_url) paste.analyze(form.lien_url, 'lien_url', state.meta.lien_url?.origin === 'manuel'); }} />
      <FormFeedback model={model} field="lien" />
      {matches.length > 0 && <Alert variant="warning" className="mt-2" title={t('form.duplicateTitle')}><ul>{matches.map((item) => <li key={item.id}><a className="inline-flex min-h-11 items-center text-brand-700 underline" href={`#/anomalies/${item.id}`}>{item.reference}</a></li>)}</ul></Alert>}
    </div>
    <SourcePicker model={model} />
    <Select id="plateforme" label={t('field.platform')} value={form.plateforme} hint={state.meta.plateforme?.origin === 'auto' ? t('form.detectedBadge') : undefined}
      onChange={(event) => set('plateforme', event.target.value)} options={PLATEFORMES.map((value) => ({ value, label: t(`platform.${value}`) }))} />
    <Select id="contenu_type" label={t('field.contentType')} placeholder={t('common.choose')} value={form.contenu_type || ''}
      onChange={(event) => set('contenu_type', event.target.value || null)} options={CONTENU_TYPES.map((value) => ({ value, label: t(`content.${value}`) }))} />
    <Input id="date_publication" label={t('field.publicationDate')} type="date" max={todayAlgiers()} value={form.date_publication} error={errors.date_publication}
      hint={form.date_publication_estimee ? t('date.estimee', { date: form.date_publication }) : undefined} onChange={(event) => set('date_publication', event.target.value)} />
    <Input id="date_signalement" label={t('field.reportDate')} type="date" max={todayAlgiers()} required value={form.date_signalement} error={errors.date_signalement} onChange={(event) => set('date_signalement', event.target.value)} />
  </Section>;
}
export function ClassificationSection({ model }) {
  const { t } = useI18n(); const { state, set, errors, refs, lang, chooseType } = model; const form = state.values;
  const types = refs.domaines.flatMap((domain) => (domain.types || []).map((type) => ({ ...type, parent: domain })));
  const recent = state.recentTypes.map((id) => types.find((type) => type.id === id)).filter((type) => type && Number(type.actif) !== 0 && Number(type.parent.actif) !== 0);
  const options = types.filter((item) => !form.domaine_id || String(item.parent.id) === String(form.domaine_id)).sort((a, b) => {
    const rank = (item) => state.recentTypes.includes(item.id) ? state.recentTypes.indexOf(item.id) : 99;
    return rank(a) - rank(b);
  }).map((item) => ({ value: item.id,
    label: form.domaine_id ? refLabel(item, lang) : `${refLabel(item.parent, lang)} › ${refLabel(item, lang)}`,
    search: `${item.name_ar} ${item.name_fr} ${item.parent.name_ar} ${item.parent.name_fr}`, disabled: Number(item.actif) === 0 }));
  return <Section title={t('form.classification')}>
    {recent.length > 0 && <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold text-muted">{t('form.recentTypes')}</p><div className="flex flex-wrap gap-2">{recent.map((item) => {
      const label = `${refLabel(item.parent, lang)} › ${refLabel(item, lang)}`;
      return <Button key={item.id} size="sm" variant="secondary" aria-label={t('form.reuseType', { type: label })} onClick={() => chooseType(item.id, 'recent')}><bdi>{label}</bdi></Button>;
    })}</div></div>}
    <Combobox id="domaine_id" label={t('field.category')} placeholder={t('form.categoryPlaceholder')} required value={form.domaine_id} error={errors.domaine_id}
      options={refOptions(refs.domaines, lang)} onChange={(value) => { set('domaine_id', String(value)); set('type_id', ''); }} />
    <Combobox id="type_id" label={t('field.type')} placeholder={t('form.typePlaceholder')} required value={form.type_id} error={errors.type_id}
      options={options} onChange={chooseType} />
    <div className="sm:col-span-2"><p className="mb-2 text-sm font-semibold">{t('field.priority')}</p><SegmentedControl label={t('field.priority')}
      value={form.priorite} onChange={(value) => set('priorite', value)} options={PRIORITES.map((value) => ({ value, label: t(`priority.${value}`) }))} /></div>
  </Section>;
}
export function ProcessingSection({ model, editing }) {
  const { t, lang } = useI18n(); const { state, set, errors, refs, user } = model; const form = state.values;
  // V13 : les exigences et leurs libellés viennent uniquement de shared/statut.js.
  const needsReason = formNeedsReason(form, state.original);
  const processing = form.statut !== 'non_traite';
  const agent = (refs.agents || []).find((item) => String(item.id) === String(form.agent_id));
  const [open, setOpen] = useState(Boolean(editing) || needsReason);
  const [sansPhoto, setSansPhoto] = useState(Boolean(form.sans_photo_motif));
  useEffect(() => { if (editing || needsReason) setOpen(true); }, [editing, needsReason]);
  if (!editing && user?.role !== 'admin') return null;
  const summary = t('form.advancedSummary', { statut: libelleStatut(form.statut, lang), agent: agent ? (agent.full_name || refLabel(agent, lang)) : '—' });
  const statusHint = form.statut === 'non_traite'
    ? t('form.statusHelpNext', { statut: libelleStatut('en_cours', lang), exigences: libelleExigences('en_cours', lang) })
    : t('form.statusHelp');
  return <details data-card data-advanced className="min-w-0 rounded-lg border border-border bg-surface shadow-1" open={open}
    onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary aria-label={t('form.advanced')} className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4 font-bold hover:bg-surface2">
      <span className="flex min-w-0 flex-col"><span>{t('form.advanced')}</span><span className="truncate text-xs font-normal text-muted">{summary}</span></span>
      <ChevronDown className="advanced-chevron h-5 w-5 shrink-0" aria-hidden="true" />
    </summary>
    <div className="grid items-start gap-4 border-t border-border p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><AgentAssignmentField model={model} /></div>
      <div className="sm:col-span-2"><InterventionField combine refs={refs} values={form} value={form.epic_id}
        otherValue={form.intervenant_autre} error={errors.epic_id} errorOther={errors.intervenant_autre}
        onChange={(value) => set('epic_id', value)} onOtherChange={(value) => set('intervenant_autre', value)} /></div>
      <Select id="statut" className="sm:col-span-2" label={t('field.status')} value={form.statut} error={errors.statut} hint={statusHint}
        options={STATUTS.map((value) => ({ value, label: libelleStatut(value, lang) }))} onChange={(event) => set('statut', event.target.value)} />
      {processing && <Input id="date_intervention" label={t('field.interventionDate')} type="date" max={todayAlgiers()} value={form.date_intervention} error={errors.date_intervention} onChange={(event) => set('date_intervention', event.target.value)} />}
      {form.statut === 'traite' && <Input id="date_traitement" label={t('field.treatmentDate')} type="date" max={todayAlgiers()} value={form.date_traitement} error={errors.date_traitement} onChange={(event) => set('date_traitement', event.target.value)} />}
      {form.statut === 'traite' && <div className="space-y-2 rounded-md border border-border p-3 sm:col-span-2">
        <Checkbox label={t('photo.without')} checked={sansPhoto} onChange={(event) => {
          setSansPhoto(event.target.checked);
          if (!event.target.checked) set('sans_photo_motif', '');
        }} />
        {!sansPhoto ? <p className="text-xs text-muted">{t('photo.helpApres')}</p> : <>
          <p className="text-xs text-muted">{t('photo.withoutHelp')}</p>
          <Textarea id="sans_photo_motif" label={t('photo.withoutReason')} required maxLength={1000}
            value={form.sans_photo_motif} error={errors.sans_photo_motif} onChange={(event) => set('sans_photo_motif', event.target.value)} />
        </>}
      </div>}
      {needsReason && <Textarea id="motif" className="sm:col-span-2" required label={t('field.reason')} maxLength={1000} value={form.motif} error={errors.motif} onChange={(event) => set('motif', event.target.value)} />}
    </div></details>;
}
export function NotesSection({ model }) {
  const { t } = useI18n(); const { state, set, errors } = model;
  return <Section title={t('form.notesFiles')}>
    <Textarea id="observations" className="sm:col-span-2" label={t('field.observations')} maxLength={5000} rows={4} value={state.values.observations} error={errors.observations} onChange={(event) => set('observations', event.target.value)} />
    <PhotoAttachments model={model} />
  </Section>;
}
