import { Checkbox, Textarea } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';

export default function WorkflowEditor({ value, onChange, refs }) {
  const { t, lang } = useI18n();
  const workflow = value || { missions: [], perimetres: [], dairas: [], coordination: [], regles: [] };
  const set = (key, next) => onChange({ ...workflow, [key]: next });
  const rule = (index, changes) => set('regles', workflow.regles.map((item, i) => i === index ? { ...item, ...changes } : item));
  return <details className="rounded-md border border-border p-3"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t('workflow.title')}</summary>
    <div className="space-y-4 pt-3">{[['missions', 'workflow.missions'], ['perimetres', 'workflow.scope'], ['dairas', 'workflow.dairas'], ['coordination', 'workflow.coordination']].map(([key, label]) =>
      <Textarea key={key} label={t(label)} hint={t(key === 'dairas' ? 'workflow.dairasHelp' : 'workflow.lines')} value={workflow[key].join('\n')}
        onChange={(event) => set(key, event.target.value.split('\n'))} onBlur={() => set(key, workflow[key].map((line) => line.trim()).filter(Boolean))} />)}
      {workflow.regles.map((item, index) => <fieldset key={index} className="space-y-2 rounded-md border border-border p-3"><legend className="px-1 text-sm font-semibold">
        <bdi>{item.domaine_ids.map((id) => refLabel(refs.domaines.find((domain) => domain.id === id), lang)).join(' · ')}</bdi></legend>
        <Textarea label={t('workflow.noteFr')} value={item.note_fr} onChange={(event) => rule(index, { note_fr: event.target.value })} />
        <Textarea label={t('workflow.noteAr')} value={item.note_ar} onChange={(event) => rule(index, { note_ar: event.target.value })} />
        <Checkbox label={t('workflow.conditional')} checked={item.conditionnelle} onChange={(event) => rule(index, { conditionnelle: event.target.checked })} />
      </fieldset>)}
    </div>
  </details>;
}
