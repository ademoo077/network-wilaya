import { useEffect, useState } from 'react';
import { anomalyAction, todayAlgiers } from '@anm/shared';
import { Button, Combobox, Dialog, Input, Textarea } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';
import { useAnomalyMutation } from './useAnomalyMutation.js';
import InterventionField from './InterventionField.jsx';

const targets = {
  confirm: { field: 'verification', value: 'confirmee', title: 'detail.confirm' },
  deny: { field: 'verification', value: 'infirmee', title: 'detail.deny' },
  progress: { field: 'statut', value: 'en_cours', title: 'detail.markProgress' },
  done: { field: 'statut', value: 'traite', title: 'detail.markDone' },
  reopen: { field: 'statut', value: 'en_cours', title: 'detail.reopen' },
};
export default function AnomalyActionDialog({ action, item, onClose, onDone }) {
  const { t, lang } = useI18n(); const { refs } = useRefs(); const mutation = useAnomalyMutation();
  const target = typeof action === 'string' ? targets[action] : action;
  const [form, setForm] = useState({});
  useEffect(() => { setForm({ agent_id: '', epic_id: '', intervenant_autre: '', motif: '',
    date_verification: todayAlgiers(), date_intervention: todayAlgiers(), date_traitement: todayAlgiers() }); }, [action, item?.id]);
  if (!target || !item) return null;
  const plan = anomalyAction(item, target.field, target.value);
  const submit = async (event) => {
    event.preventDefault(); const body = { ...plan.body };
    for (const field of plan.fields) body[field] = field.endsWith('_id') ? Number(form[field]) || null : form[field] || undefined;
    try { const result = await mutation.mutateAsync({ item, field: target.field, body }); await onDone?.(result.item); onClose(); }
    catch { /* Le hook restaure le cache et affiche l'erreur. */ }
  };
  return <Dialog open onClose={onClose} title={t(target.title || (target.field === 'statut' ? 'field.status' : 'field.verification'))}
    footer={<><Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>{t('common.cancel')}</Button>
      <Button type="submit" form="anomaly-action" loading={mutation.isPending} disabled={Boolean(plan.blocked)}>{t('common.confirm')}</Button></>}>
    <form id="anomaly-action" onSubmit={submit} className="space-y-4">
      {plan.blocked && <p role="alert" className="text-danger">{t(`action.${plan.blocked}`)}</p>}
      {mutation.error && <p role="alert" className="text-danger">{mutation.error.message}</p>}
      {plan.fields.includes('agent_id') && <Combobox label={t('field.agent')} required value={form.agent_id} options={refOptions(refs.agents, lang)} onChange={(value) => setForm({ ...form, agent_id: value })} />}
      {plan.fields.includes('epic_id') && <><InterventionField refs={refs} values={item} value={form.epic_id} onChange={(value) => setForm({ ...form, epic_id: value })} />
        <Input label={t('field.otherParty')} value={form.intervenant_autre} onChange={(event) => setForm({ ...form, intervenant_autre: event.target.value })} /></>}
      {['date_verification', 'date_intervention', 'date_traitement'].filter((field) => plan.fields.includes(field)).map((field) => <Input key={field} type="date" required
        label={t({ date_verification: 'field.verificationDate', date_intervention: 'field.interventionDate', date_traitement: 'field.treatmentDate' }[field])}
        value={form[field]} min={item.date_signalement} max={todayAlgiers()} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}
      {plan.fields.includes('motif') && <Textarea label={t('field.reason')} required maxLength={1000} value={form.motif} onChange={(event) => setForm({ ...form, motif: event.target.value })} />}
    </form>
  </Dialog>;
}
