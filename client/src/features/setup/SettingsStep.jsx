import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Alert, Button, Card, Input, Select, useToast } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useRefs } from '../../context/RefsContext.jsx';

export default function SettingsStep({ onSaved }) {
  const { t } = useI18n();
  const { reload } = useRefs();
  const { push } = useToast();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { api('/settings').then((result) => setForm(result.item)).catch((error) => push(error.message, 'danger')); }, [push]);
  if (!form) return <Card className="p-5"><p className="text-sm text-muted">{t('common.loading')}</p></Card>;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setLoading(true);
    try {
      const payload = { ...form }; delete payload.exiger_verification;
      await api('/settings', { method: 'PUT', body: payload });
      await reload(); push(t('setup.completed')); onSaved?.();
    } catch (error) { push(error.message, 'danger'); } finally { setLoading(false); }
  };
  return <Card className="max-w-3xl p-5"><Alert className="mb-5">{t('setup.intro')}</Alert><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><Input className="sm:col-span-2" label={t('app.cell')} value={form.nom_cellule} onChange={(event) => set('nom_cellule', event.target.value)} required /><Select label="week_start_day" value={form.week_start_day} onChange={(event) => set('week_start_day', Number(event.target.value))} options={[0, 1, 2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }))} /><Input label={t('dashboard.days')} type="number" min="1" value={form.delai_retard_jours} onChange={(event) => set('delai_retard_jours', Number(event.target.value))} /><Input className="sm:col-span-2" label="tile_url" value={form.tile_url} onChange={(event) => set('tile_url', event.target.value)} required /><Input label="backup_retention_days" type="number" min="1" value={form.backup_retention_days} onChange={(event) => set('backup_retention_days', Number(event.target.value))} /><Input label="gps_bbox" value={form.gps_bbox} onChange={(event) => set('gps_bbox', event.target.value)} /><div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={loading}>{t('common.save')}</Button></div></form></Card>;
}
