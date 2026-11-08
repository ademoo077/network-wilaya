import { useEffect, useState } from 'react';
import { todayAlgiers } from '@anm/shared';
import { api } from '../../api/client.js';
import { Button, Combobox, Dialog, Input, Textarea } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';

const targets = {
  confirm: { type: 'verification', value: 'confirmee', title: 'detail.confirm' },
  deny: { type: 'verification', value: 'infirmee', title: 'detail.deny' },
  progress: { type: 'statut', value: 'en_cours', title: 'detail.markProgress' },
  done: { type: 'statut', value: 'traite', title: 'detail.markDone' },
  reopen: { type: 'statut', value: 'en_cours', title: 'detail.reopen' },
};

export default function AnomalyActionDialog({ action, item, onClose, onDone }) {
  const { t, lang } = useI18n();
  const { refs } = useRefs();
  const target = targets[action];
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setForm({
      agent_id: item?.agent_id ? String(item.agent_id) : '', epic_id: item?.epic_id ? String(item.epic_id) : '',
      intervenant_autre: item?.intervenant_autre || '', date_verification: item?.date_verification || todayAlgiers(),
      date_intervention: item?.date_intervention || todayAlgiers(), date_traitement: item?.date_traitement || todayAlgiers(), motif: '',
    });
    setError('');
  }, [action, item]);
  if (!target || !item) return null;
  const verification = target.type === 'verification';
  const needsAgent = verification && !item.agent_id;
  const needsParty = !verification && target.value !== 'non_traite' && !item.epic_id && !item.intervenant_autre;
  const reasonRequired = action === 'deny' || action === 'reopen';
  const submit = async () => {
    setLoading(true); setError('');
    try {
      const body = { version: item.version, [target.type]: target.value };
      if (verification) {
        body.agent_id = form.agent_id ? Number(form.agent_id) : item.agent_id;
        body.date_verification = form.date_verification;
      } else {
        body.epic_id = form.epic_id ? Number(form.epic_id) : item.epic_id;
        body.intervenant_autre = form.intervenant_autre || item.intervenant_autre || null;
        body.date_intervention = form.date_intervention;
        if (target.value === 'traite') body.date_traitement = form.date_traitement;
      }
      if (form.motif) body.motif = form.motif;
      const response = await api(`/anomalies/${item.id}/${target.type}`, { method: 'POST', body });
      await onDone(response.item); onClose();
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  };
  return <Dialog open={Boolean(action)} onClose={onClose} title={t(target.title)} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={loading} onClick={submit}>{t('common.confirm')}</Button></>}><div className="space-y-4">{error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}{needsAgent && <Combobox label={t('field.agent')} required value={form.agent_id} options={refOptions(refs.agents, lang)} onChange={(value) => setForm({ ...form, agent_id: value })} />}{verification && <Input label={t('field.verificationDate')} type="date" value={form.date_verification} onChange={(event) => setForm({ ...form, date_verification: event.target.value })} />}{needsParty && <><Combobox label={t('field.epic')} value={form.epic_id} options={refOptions(refs.epics, lang)} onChange={(value) => setForm({ ...form, epic_id: value })} /><Input label={t('field.otherParty')} value={form.intervenant_autre} onChange={(event) => setForm({ ...form, intervenant_autre: event.target.value })} /></>}{!verification && <Input label={t('field.interventionDate')} type="date" value={form.date_intervention} onChange={(event) => setForm({ ...form, date_intervention: event.target.value })} />}{action === 'done' && <Input label={t('field.treatmentDate')} type="date" value={form.date_traitement} onChange={(event) => setForm({ ...form, date_traitement: event.target.value })} />}{reasonRequired && <Textarea label={t('field.reason')} required maxLength={1000} value={form.motif} onChange={(event) => setForm({ ...form, motif: event.target.value })} />}</div></Dialog>;
}
