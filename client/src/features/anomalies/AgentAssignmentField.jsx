import { useMemo, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { Button, Combobox, Textarea } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';

/** V13 : affectation automatique en lecture seule, surcharge manuelle motivée. */
export default function AgentAssignmentField({ model }) {
  const { t, lang } = useI18n(); const { state, set, errors, refs } = model; const form = state.values;
  const [editing, setEditing] = useState(!form.daira_id && !form.agent_id);
  const [draftAgent, setDraftAgent] = useState('');
  const [draftMotif, setDraftMotif] = useState(''); const [localError, setLocalError] = useState('');
  const [motifVisible, setMotifVisible] = useState(false);

  const auto = useMemo(() => {
    if (!form.daira_id) return null;
    const rows = refs.affectations || [];
    const matches = rows.filter((row) => String(row.daira_id) === String(form.daira_id));
    const titulaire = matches.find((row) => row.role === 'titulaire');
    return titulaire || matches.find((row) => row.role === 'suppleant') || null;
  }, [form.daira_id, refs.affectations]);

  const manual = form.agent_source === 'manuel' && Boolean(form.agent_id);
  const shown = manual ? (refs.agents || []).find((agent) => String(agent.id) === String(form.agent_id)) || auto : auto;
  const draftSelected = (refs.agents || []).find((agent) => String(agent.id) === String(draftAgent));
  const daira = (refs.dairas || []).find((item) => String(item.id) === String(form.daira_id));
  const dairaName = daira ? (lang === 'ar' ? (daira.name_ar || daira.name_fr) : (daira.name_fr || daira.name_ar)) : '';
  const agentName = shown ? (shown.full_name || refLabel(shown, lang)) : '';

  const apply = () => {
    if (!draftAgent || !draftMotif.trim()) { setLocalError(t('validation.required')); return; }
    set('agent_id', String(draftAgent)); set('agent_motif', draftMotif.trim()); set('agent_source', 'manuel');
    setEditing(false); setMotifVisible(false); setLocalError('');
  };
  const reset = () => { set('agent_id', ''); set('agent_motif', ''); set('agent_source', 'auto'); setEditing(false); setMotifVisible(false); setLocalError(''); };

  return <div className="min-w-0 space-y-2" data-agent-assignment>
    <p className="text-sm font-semibold">{t('form.agentAuto')}</p>
    {!form.daira_id ? <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted">{t('form.agentChooseDaira')}</p> : shown ? <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-surface2 px-3 text-sm"><UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" /><bdi>{agentName}</bdi>{dairaName && <span className="text-muted">· <bdi>{dairaName}</bdi></span>}</span>
      {manual && <span className="rounded-sm bg-surface2 px-2 py-1 text-xs font-semibold text-muted">{t('form.agentManual')}</span>}
      <Button size="sm" variant="secondary" onClick={() => { setDraftAgent(String(shown.id || form.agent_id || '')); setDraftMotif(form.agent_motif || ''); setEditing(true); setMotifVisible(true); }} aria-expanded={editing}>{t('form.agentModify')}</Button>
      {manual && <Button size="sm" variant="ghost" onClick={reset}>{t('form.agentReset')}</Button>}
    </div> : <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md border border-dashed border-border p-3 text-sm text-muted">{t('form.agentNoCandidate')}</span>
      <Button size="sm" variant="secondary" onClick={() => { setEditing(true); setMotifVisible(true); }} aria-expanded={editing}>{t('form.agentModify')}</Button>
    </div>}
    {editing && <div className="grid gap-3 rounded-md border border-border bg-surface2 p-3">
      <p className="text-xs text-muted">{t('form.agentModifyHelp')}</p>
      <Combobox id="agent_id" label={t('field.agent')} placeholder={t('form.agentSearch')} value={draftAgent} error={errors.agent_id}
        options={refOptions(refs.agents || [], lang, { noEmail: true })} onChange={(value) => { setDraftAgent(String(value)); if (value) setMotifVisible(true); }} />
      {draftSelected && <p className="flex flex-wrap gap-x-2 text-xs text-muted"><bdi>{draftSelected.grade}</bdi><bdi className="break-all">{draftSelected.email}</bdi></p>}
      {motifVisible && <Textarea id="agent_motif" label={t('field.reason')} required maxLength={1000} value={draftMotif}
        error={localError || errors.agent_motif} onChange={(event) => { setDraftMotif(event.target.value); setLocalError(''); }} />}
      <div className="flex flex-wrap gap-2"><Button size="sm" onClick={apply}>{t('form.agentApply')}</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(false); setMotifVisible(false); setLocalError(''); }}>{t('common.cancel')}</Button></div>
    </div>}
  </div>;
}
