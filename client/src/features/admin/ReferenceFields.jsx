import { Checkbox, Combobox, Input } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { refOptions } from '../anomalies/helpers.js';
import WorkflowEditor from './WorkflowEditor.jsx';

export function emptyReference(entity) {
  if (['domaines', 'dairas'].includes(entity)) return { name_ar: '', name_fr: '' };
  if (entity === 'types') return { domaine_id: '', name_ar: '', name_fr: '' };
  if (entity === 'communes') return { daira_id: '', name_fr: '', name_ar: '' };
  if (entity === 'epics') return { name: '', sigle: '', contact_nom: '', contact_tel: '', domaine_ids: [] };
  return { full_name: '', grade: '', email: '', matricule: '', telephone: '', zone_daira_id: '' };
}
export default function ReferenceFields({ entity, form, set, refs }) {
  const { t, lang } = useI18n();
  const text = (key, label, required = false, type = 'text') => <Input key={key} type={type} label={t(label)} required={required}
    value={form[key] ?? ''} onChange={(event) => set(key, event.target.value)} />;
  return <>
    {entity === 'types' && <Combobox label={t('field.category')} required value={form.domaine_id}
      options={refOptions(refs.domaines, lang)} onChange={(value) => set('domaine_id', value)} />}
    {['communes', 'agents'].includes(entity) && <Combobox label={t('field.daira')} required={entity === 'communes'} value={form[entity === 'communes' ? 'daira_id' : 'zone_daira_id']}
      options={refOptions(refs.dairas, lang)} onChange={(value) => set(entity === 'communes' ? 'daira_id' : 'zone_daira_id', value)} />}
    {['domaines', 'types', 'dairas', 'communes'].includes(entity) && <>
      {text('name_ar', 'field.nameAr', ['domaines', 'types'].includes(entity))}{text('name_fr', 'field.nameFr', ['dairas', 'communes'].includes(entity))}</>}
    {entity === 'epics' && <>{text('name', 'field.name', true)}{text('sigle', 'field.acronym')}{text('contact_nom', 'field.contact')}{text('contact_tel', 'field.phone', false, 'tel')}
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">{t('field.skills')}</legend><div className="max-h-60 overflow-auto rounded-md border border-border p-3">
        {refs.domaines.map((domain) => <Checkbox key={domain.id} label={refLabel(domain, lang)} checked={form.domaine_ids?.includes(domain.id) || false}
          onChange={(event) => set('domaine_ids', event.target.checked ? [...(form.domaine_ids || []), domain.id] : form.domaine_ids.filter((id) => id !== domain.id))} />)}
      </div></fieldset><WorkflowEditor value={form.workflow} onChange={(value) => set('workflow', value)} refs={refs} /></>}
    {entity === 'agents' && <>{text('full_name', 'field.name', true)}{text('grade', 'field.grade')}{text('email', 'field.email', false, 'email')}
      {text('matricule', 'field.registration')}{text('telephone', 'field.phone', false, 'tel')}</>}
  </>;
}
