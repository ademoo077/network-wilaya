import { useEffect, useState } from 'react';
import { todayAlgiers } from '@anm/shared';
import { api } from '../../api/client.js';
import { Alert, Button, Combobox, Dialog, Input, Select, Textarea } from '../../components/ui/index.js';
import { refOptions } from './helpers.js';
import { useI18n } from '../../i18n/index.jsx';
import { useRefs } from '../../context/RefsContext.jsx';

export default function BulkStatusDialog({ open, onClose, ids, initialStatus = 'en_cours', onDone }) {
  const { t, lang } = useI18n();
  const { refs } = useRefs();
  const [form, setForm] = useState({ statut: initialStatus, epic_id: '', intervenant_autre: '', date_intervention: todayAlgiers(), date_traitement: todayAlgiers(), motif: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => { setForm((current) => ({ ...current, statut: initialStatus })); setResult(null); }, [initialStatus, open]);
  const submit = async () => {
    setLoading(true);
    try {
      const body = { ids, statut: form.statut, epic_id: form.epic_id ? Number(form.epic_id) : null, intervenant_autre: form.intervenant_autre || null, motif: form.motif || undefined };
      if (form.statut !== 'non_traite') body.date_intervention = form.date_intervention || undefined;
      if (form.statut === 'traite') body.date_traitement = form.date_traitement || undefined;
      const response = await api('/anomalies/bulk-statut', { method: 'POST', body });
      setResult(response.item); await onDone?.();
    } catch (error) { setResult({ ok: [], echecs: [{ id: '—', message: error.message }] }); } finally { setLoading(false); }
  };
  return <Dialog open={open} onClose={onClose} title={t('anomalies.bulk')} footer={<><Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>{!result && <Button loading={loading} onClick={submit}>{t('common.confirm')}</Button>}</>}><div className="space-y-4"><Alert>{t('anomalies.selected', { count: ids.length })}</Alert><Select label={t('field.status')} value={form.statut} options={['non_traite', 'en_cours', 'traite'].map((value) => ({ value, label: t(`status.${value}`) }))} onChange={(event) => setForm({ ...form, statut: event.target.value })} />{form.statut !== 'non_traite' && <><Combobox label={t('field.epic')} options={refOptions(refs.epics, lang)} value={form.epic_id} onChange={(value) => setForm({ ...form, epic_id: value })} /><Input label={t('field.otherParty')} value={form.intervenant_autre} onChange={(event) => setForm({ ...form, intervenant_autre: event.target.value })} /><Input label={t('field.interventionDate')} type="date" value={form.date_intervention} onChange={(event) => setForm({ ...form, date_intervention: event.target.value })} /></>}{form.statut === 'traite' && <Input label={t('field.treatmentDate')} type="date" value={form.date_traitement} onChange={(event) => setForm({ ...form, date_traitement: event.target.value })} />}<Textarea label={t('field.reason')} maxLength={1000} value={form.motif} onChange={(event) => setForm({ ...form, motif: event.target.value })} />{result && <Alert variant={result.echecs.length ? 'warning' : 'success'} title={t('anomalies.bulkResult', { ok: result.ok.length, failed: result.echecs.length })}>{result.echecs.map((failure) => <p key={`${failure.id}-${failure.code}`}><bdi>{failure.id}</bdi> — {failure.message}</p>)}</Alert>}</div></Dialog>;
}
