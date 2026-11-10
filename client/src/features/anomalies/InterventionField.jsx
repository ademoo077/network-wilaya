import { useMemo } from 'react';
import { interventionCandidates } from '@anm/shared';
import { Button, Select } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export function WorkflowSummary({ workflow, name }) {
  const { t } = useI18n();
  if (!workflow) return null;
  return <details data-workflow={name} className="rounded-md border border-border bg-surface2 p-3 text-sm">
    <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t('workflow.missions')} · <bdi>{name}</bdi></summary>
    <div className="space-y-3 pt-2"><ul className="list-inside list-disc space-y-1">{workflow.missions.map((mission, index) => <li key={index}><bdi>{mission}</bdi></li>)}</ul>
      <p className="font-semibold">{t('workflow.scope')}</p><ul className="space-y-1">{workflow.perimetres.map((scope, index) => <li key={index}><bdi>{scope}</bdi></li>)}</ul>
      {workflow.coordination.length > 0 && <p>{t('workflow.coordination')} : <bdi>{workflow.coordination.join(' · ')}</bdi></p>}
    </div>
  </details>;
}

export default function InterventionField({ refs, values, value, onChange, error, id = 'epic_id' }) {
  const { t, lang } = useI18n();
  const { domaine_id, type_id, daira_id } = values;
  const candidates = useMemo(() => interventionCandidates(refs, { domaine_id, type_id, daira_id }), [refs, domaine_id, type_id, daira_id]);
  const selected = candidates.find(({ epic }) => String(epic.id) === String(value));
  const proposals = candidates.filter((item) => item.proposed);
  return <div className="min-w-0 space-y-2" data-intervention-field>
    <Select id={id} label={t('field.epic')} placeholder={t('form.unassigned')} value={value || ''} error={error}
      onChange={(event) => onChange(event.target.value)} options={candidates.filter(({ epic }) => epic.actif || String(epic.id) === String(value)).map(({ epic, state, proposed }) => ({
        value: epic.id, label: `${epic.name}${proposed ? ` · ${t(`workflow.${state}`)}` : ''}`, disabled: !epic.actif,
      }))} />
    {selected?.state === 'outside' && <p role="status" className="text-sm text-warning">{t('workflow.outside')}</p>}
    {selected?.notes?.map((note, index) => (note[`note_${lang}`] || note.note_ar) && <p key={index} className="text-sm text-ink2" role="status">{note[`note_${lang}`] || note.note_ar}</p>)}
    {!selected && proposals.length > 0 && <details open className="text-sm" data-intervention-suggestions><summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t('workflow.suggestions')}</summary>
      <ul className="space-y-2">{proposals.map(({ epic, state, notes }) => <li key={epic.id} className="rounded-md border border-border p-2">
        <Button variant="secondary" className="w-full justify-start" onClick={() => onChange(String(epic.id))}><bdi>{epic.name}</bdi> · {t(`workflow.${state}`)}</Button>
        {notes.map((note, index) => (note[`note_${lang}`] || note.note_ar) && <p key={index} className="mt-1 text-xs text-muted">{note[`note_${lang}`] || note.note_ar}</p>)}
      </li>)}</ul></details>}
    {selected?.epic.workflow && <WorkflowSummary workflow={selected.epic.workflow} name={selected.epic.name} />}
  </div>;
}
