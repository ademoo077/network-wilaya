import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Button, Card, Checkbox, Input, Select, useToast } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';

const numeric = new Set([
  'week_start_day', 'delai_retard_jours', 'backup_retention_days', 'rayon_doublon_m',
  'objectif_taux_traitement', 'sla_urgente_j', 'sla_haute_j', 'sla_normale_j',
]);
const booleans = ['enrichissement_en_ligne', 'enrichissement_metadonnees', 'rapport_auto_fige', 'https_actif'];
const visible = [
  'nom_cellule', 'week_start_day', 'delai_retard_jours', 'tile_url',
  'backup_retention_days', 'gps_bbox', 'rayon_doublon_m', 'objectif_taux_traitement',
  'sla_urgente_j', 'sla_haute_j', 'sla_normale_j',
  'enrichissement_en_ligne', 'enrichissement_metadonnees', 'resolution_liens', 'rapport_auto_fige', 'https_actif',
];

export default function SettingsAdmin() {
  const { t } = useI18n();
  const { reload } = useRefs();
  const { push } = useToast();
  const [form, setForm] = useState(null);
  useEffect(() => { api('/settings').then((result) => setForm(result.item)).catch((error) => push(error.message, 'danger')); }, [push]);
  if (!form) return <p className="text-sm text-muted">{t('common.loading')}</p>;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => { try { const result = await api('/settings', { method: 'PUT', body: form }); setForm(result.item); await reload(); push(t('common.success')); } catch (error) { push(error.message, 'danger'); } };
  return <Card className="max-w-4xl p-5"><div className="grid gap-4 sm:grid-cols-2">{visible.map((key) => booleans.includes(key) ? <Checkbox key={key} className="self-end" label={key} checked={Number(form[key]) === 1} onChange={(event) => set(key, event.target.checked ? 1 : 0)} /> : key === 'week_start_day' ? <Select key={key} label={key} value={form[key]} options={[0, 1, 2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }))} onChange={(event) => set(key, Number(event.target.value))} /> : <Input key={key} className={['nom_cellule', 'tile_url'].includes(key) ? 'sm:col-span-2' : ''} label={key} type={numeric.has(key) ? 'number' : 'text'} value={form[key] ?? ''} onChange={(event) => set(key, numeric.has(key) ? Number(event.target.value) : event.target.value)} />)}</div><div className="mt-5 flex justify-end"><Button onClick={save}>{t('common.save')}</Button></div></Card>;
}
