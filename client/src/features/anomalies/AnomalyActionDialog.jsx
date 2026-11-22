import { useEffect, useState } from 'react';
import { anomalyAction, todayAlgiers } from '@anm/shared';
import { Alert, Button, Checkbox, Combobox, Dialog, Input, Textarea, useToast } from '../../components/ui/index.js';
import { api } from '../../api/client.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { refOptions } from './helpers.js';
import { useAnomalyMutation } from './useAnomalyMutation.js';
import InterventionField from './InterventionField.jsx';
import { compress } from './photos/usePhotoLibrary.js';

const targets = {
  progress: { field: 'statut', value: 'en_cours', title: 'detail.markProgress' },
  done: { field: 'statut', value: 'traite', title: 'detail.markDone' },
  reopen: { field: 'statut', value: 'en_cours', title: 'detail.reopen' },
};
export default function AnomalyActionDialog({ action, item, pieces = [], onClose, onDone }) {
  const { t, lang } = useI18n(); const { push } = useToast();
  const { refs } = useRefs(); const mutation = useAnomalyMutation();
  const target = typeof action === 'string' ? targets[action] : action;
  const [form, setForm] = useState({});
  const [sansPhoto, setSansPhoto] = useState(false);
  const [sansPhotoMotif, setSansPhotoMotif] = useState('');
  const [markedAfter, setMarkedAfter] = useState(false);
  const [afterFile, setAfterFile] = useState(null);
  const [afterPreview, setAfterPreview] = useState('');
  const [localError, setLocalError] = useState('');
  useEffect(() => () => { if (afterPreview) URL.revokeObjectURL(afterPreview); }, [afterPreview]);
  useEffect(() => {
    setForm({ agent_id: '', epic_id: '', intervenant_autre: '', motif: '',
      date_intervention: todayAlgiers(), date_traitement: todayAlgiers() });
    setSansPhoto(false); setSansPhotoMotif(''); setMarkedAfter(false); setLocalError('');
    setAfterFile(null); setAfterPreview('');
  }, [action, item?.id]);
  if (!target || !item) return null;
  const isDone = target.field === 'statut' && target.value === 'traite';
  const existingAfter = markedAfter || pieces.some((piece) => piece.role === 'apres');
  const hasAfter = existingAfter || Boolean(afterFile);
  const plan = anomalyAction(item, target.field, target.value);
  const markAfter = async (piece) => {
    try {
      await api(`/pieces/${piece.id}`, { method: 'PATCH', body: { role: 'apres', principale: true } });
      setMarkedAfter(true); setSansPhoto(false); setLocalError('');
      push(t('photo.apres') + ' ✓');
    } catch (error) { setLocalError(error.message); }
  };
  const chooseAfter = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      setAfterPreview(URL.createObjectURL(file));
      setAfterFile(await compress(file));
      setSansPhoto(false); setLocalError('');
    } catch (error) { setLocalError(error.message); }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (isDone && !hasAfter && (!sansPhoto || !sansPhotoMotif.trim())) {
      setLocalError(t('photo.required')); return;
    }
    const body = { ...plan.body };
    for (const field of plan.fields) body[field] = field.endsWith('_id') ? Number(form[field]) || null : form[field] || undefined;
    if (isDone && !hasAfter) body.sans_photo_motif = sansPhotoMotif.trim();
    if (isDone && afterFile) {
      const upload = new FormData();
      upload.append('file', afterFile);
      upload.append('role', 'apres');
      upload.append('principale', '1');
      try {
        await api(`/anomalies/${item.id}/pieces`, { method: 'POST', body: upload });
      } catch (error) { setLocalError(error.message); return; }
    }
    try {
      const result = await mutation.mutateAsync({ item, field: target.field, body });
      await onDone?.(result.item); onClose();
    } catch { /* Le hook restaure le cache et affiche l'erreur. */ }
  };
  return <Dialog open onClose={onClose} title={t(target.title || 'field.status')}
    footer={<><Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>{t('common.cancel')}</Button>
      <Button type="submit" form="anomaly-action" loading={mutation.isPending} disabled={Boolean(plan.blocked)}>{t('common.confirm')}</Button></>}>
    <form id="anomaly-action" onSubmit={submit} className="space-y-4">
      {plan.blocked && <p role="alert" className="text-danger">{t(`action.${plan.blocked}`)}</p>}
      {(mutation.error || localError) && <Alert variant="danger">{localError || mutation.error.message}</Alert>}
      {plan.fields.includes('agent_id') && <Combobox label={t('field.agent')} required value={form.agent_id} options={refOptions(refs.agents, lang)} onChange={(value) => setForm({ ...form, agent_id: value })} />}
      {plan.fields.includes('epic_id') && <><InterventionField refs={refs} values={item} value={form.epic_id} onChange={(value) => setForm({ ...form, epic_id: value })} />
        <Input label={t('field.otherParty')} value={form.intervenant_autre} onChange={(event) => setForm({ ...form, intervenant_autre: event.target.value })} /></>}
      {['date_intervention', 'date_traitement'].filter((field) => plan.fields.includes(field)).map((field) => <Input key={field} type="date" required
        label={t({ date_intervention: 'field.interventionDate', date_traitement: 'field.treatmentDate' }[field])}
        value={form[field]} min={item.date_signalement} max={todayAlgiers()} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}
      {isDone && <div className="space-y-3 rounded-md border border-border bg-surface2 p-3">
        <p className="text-sm font-bold text-ink">{t('photo.apres')}</p>
        {existingAfter ? <p className="text-sm text-ink2">{t('photo.apres')} ✓</p> : <>
          <p className="text-xs text-muted">{t('photo.helpApres')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-bold text-brand-50">
              {t('photo.uploadAfter')}
              <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" data-photo-dialog-upload onChange={chooseAfter} />
            </label>
            {afterPreview && <img src={afterPreview} alt={t('photo.preview')} data-photo-dialog-preview className="h-16 w-16 rounded-sm border border-border bg-surface2 object-cover" />}
          </div>
          {pieces.filter((piece) => piece.role !== 'apres').length > 0 && <div className="flex flex-wrap gap-2">
            {pieces.filter((piece) => piece.role !== 'apres').map((piece) => <Button key={piece.id} type="button" size="sm" variant="secondary"
              data-photo-select={piece.id} onClick={() => markAfter(piece)}>{t('photo.markApres')} · {piece.nom_original}</Button>)}
          </div>}
          <Checkbox label={t('photo.without')} checked={sansPhoto} onChange={(event) => setSansPhoto(event.target.checked)} />
          {sansPhoto && <><p className="text-xs text-muted">{t('photo.withoutHelp')}</p>
            <Textarea label={t('photo.withoutReason')} required maxLength={1000} value={sansPhotoMotif}
              onChange={(event) => setSansPhotoMotif(event.target.value)} /></>}
        </>}
      </div>}
      {plan.fields.includes('motif') && <Textarea label={t('field.reason')} required maxLength={1000} value={form.motif} onChange={(event) => setForm({ ...form, motif: event.target.value })} />}
    </form>
  </Dialog>;
}
