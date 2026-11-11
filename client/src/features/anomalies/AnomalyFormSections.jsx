import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONTENU_TYPES, PLATEFORMES, PRIORITES, STATUTS, VERIFICATIONS, formNeedsReason, todayAlgiers } from '@anm/shared';
import { Card, CardHeader, Combobox, Input, Select, SegmentedControl, Textarea, Alert, Button } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';
import FormFeedback from './FormFeedback.jsx';
import InterventionField from './InterventionField.jsx';
import PhotoAttachments from './PhotoAttachments.jsx';

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
  const { t } = useI18n(); const { state, set, errors, refs, lang } = model; const form = state.values;
  const needsReason = formNeedsReason(form, state.original);
  const permitted = form.verification === 'confirmee' && form.agent_id && (form.epic_id || form.intervenant_autre.trim());
  const processing = form.statut !== 'non_traite';
  const agent = refs.agents.find((item) => String(item.id) === form.agent_id);
  const [open, setOpen] = useState(Boolean(editing) || needsReason);
  useEffect(() => { if (editing || needsReason) setOpen(true); }, [editing, needsReason]);
  return <details data-card data-advanced className="min-w-0 rounded-lg border border-border bg-surface shadow-1" open={open}
    onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4 font-bold hover:bg-surface2">
      <span>{t('form.advanced')}</span><ChevronDown className="advanced-chevron h-5 w-5 shrink-0" aria-hidden="true" />
    </summary>
    <div className="grid items-start gap-4 border-t border-border p-5 sm:grid-cols-2">
      <Select id="verification" label={t('field.verification')} value={form.verification} error={errors.verification}
        options={VERIFICATIONS.map((value) => ({ value, label: t(`verification.${value}`), disabled: value === 'infirmee' && processing }))} onChange={(event) => set('verification', event.target.value)} />
      <div><Combobox id="agent_id" label={t('field.agent')} placeholder={t('form.agentSearch')} required={form.verification !== 'a_verifier'} value={form.agent_id} error={errors.agent_id} options={refOptions(refs.agents, lang, { includeInactive: true })} onChange={(value) => set('agent_id', String(value))} />
        {agent && <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted"><bdi>{agent.grade}</bdi><bdi className="break-all">{agent.email}</bdi></p>}</div>
      {form.verification !== 'a_verifier' && <Input id="date_verification" label={t('field.verificationDate')} type="date" max={todayAlgiers()} value={form.date_verification} error={errors.date_verification} onChange={(event) => set('date_verification', event.target.value)} />}
      <InterventionField refs={refs} values={form} value={form.epic_id} error={errors.epic_id} onChange={(value) => set('epic_id', value)} />
      {!form.epic_id && <Input id="intervenant_autre" label={t('field.otherParty')} value={form.intervenant_autre} error={errors.intervenant_autre} onChange={(event) => set('intervenant_autre', event.target.value)} />}
      <Select id="statut" className="sm:col-span-2" label={t('field.status')} value={form.statut} error={errors.statut} hint={t('form.statusHelp')}
        options={STATUTS.map((value) => ({ value, label: `${t(`status.${value}`)}${value !== 'non_traite' && !permitted ? ` — ${t('form.statusBlocked')}` : ''}`, disabled: value !== form.statut && value !== 'non_traite' && !permitted }))} onChange={(event) => set('statut', event.target.value)} />
      {processing && <Input id="date_intervention" label={t('field.interventionDate')} type="date" max={todayAlgiers()} value={form.date_intervention} error={errors.date_intervention} onChange={(event) => set('date_intervention', event.target.value)} />}
      {form.statut === 'traite' && <Input id="date_traitement" label={t('field.treatmentDate')} type="date" max={todayAlgiers()} value={form.date_traitement} error={errors.date_traitement} onChange={(event) => set('date_traitement', event.target.value)} />}
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
