import { useCallback, useEffect, useState } from 'react';
import { Plus, Power } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, Combobox, DataTable, Dialog, Input, Tabs, useToast } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { refOptions } from '../anomalies/helpers.js';
import LimitsAdmin from './LimitsAdmin.jsx';

const entities = ['domaines', 'types', 'dairas', 'communes', 'epics', 'agents', 'limites'];
const labelKeys = { domaines: 'admin.domains', types: 'admin.types', dairas: 'admin.dairas', communes: 'admin.communes', epics: 'admin.epics', agents: 'admin.agents', limites: 'admin.limits' };

function initial(entity) {
  if (entity === 'domaines') return { name_ar: '', name_fr: '' };
  if (entity === 'types') return { domaine_id: '', name_ar: '', name_fr: '' };
  if (entity === 'dairas') return { name_fr: '', name_ar: '' };
  if (entity === 'communes') return { daira_id: '', name_fr: '', name_ar: '' };
  if (entity === 'epics') return { name: '', sigle: '', domaine_ids: [] };
  return { full_name: '', matricule: '', telephone: '', zone_daira_id: '' };
}

export default function ReferencesAdmin() {
  const { t, lang } = useI18n();
  const { refs, reload } = useRefs();
  const { push } = useToast();
  const [entity, setEntity] = useState('domaines');
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial(entity));
  const load = useCallback(async () => { if (entity === 'limites') { setRows([]); return; } const result = await api(`/ref/${entity}`); setRows(result.items); }, [entity]);
  useEffect(() => { load().catch((error) => push(error.message, 'danger')); }, [load, push]);
  useEffect(() => setForm(initial(entity)), [entity]);
  const name = (row) => row.name || row.full_name || refLabel(row, lang);
  const columns = [
    { key: 'name', label: t('field.name'), render: (row) => <bdi className="font-semibold">{name(row)}</bdi> },
    { key: 'actif', label: t('common.active'), render: (row) => row.actif ? t('common.yes') : t('common.no') },
    { key: 'actions', label: t('common.actions'), render: (row) => <Button size="sm" variant="ghost" onClick={() => toggle(row)}><Power className="h-4 w-4" />{row.actif ? t('admin.deactivate') : t('admin.activate')}</Button> },
  ];
  const toggle = async (row) => {
    try {
      if (row.actif) await api(`/ref/${entity}/${row.id}`, { method: 'DELETE' });
      else await api(`/ref/${entity}/${row.id}`, { method: 'PATCH', body: { actif: 1 } });
      await Promise.all([load(), reload()]); push(t('common.success'));
    } catch (error) { push(error.message, 'danger'); }
  };
  const submit = async () => {
    try {
      const body = { ...form };
      for (const key of ['domaine_id', 'daira_id', 'zone_daira_id']) if (body[key]) body[key] = Number(body[key]); else if (key === 'zone_daira_id') body[key] = null;
      await api(`/ref/${entity}`, { method: 'POST', body });
      setOpen(false); setForm(initial(entity)); await Promise.all([load(), reload()]); push(t('common.success'));
    } catch (error) { push(error.message, 'danger'); }
  };
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  if (entity === 'limites') return <><Tabs ariaLabel={t('admin.references')} tabs={entities.map((value) => ({ value, label: t(labelKeys[value]) }))} value={entity} onChange={setEntity} /><div className="mt-5"><LimitsAdmin /></div></>;
  return <><div className="flex flex-wrap items-center justify-between gap-3"><Tabs ariaLabel={t('admin.references')} tabs={entities.map((value) => ({ value, label: t(labelKeys[value]) }))} value={entity} onChange={setEntity} /><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('common.add')}</Button></div><Card className="mt-5 overflow-hidden"><DataTable columns={columns} rows={rows} /></Card><Dialog open={open} onClose={() => setOpen(false)} title={`${t('common.add')} · ${t(labelKeys[entity])}`} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={submit}>{t('common.save')}</Button></>}><div className="space-y-4">{entity === 'types' && <Combobox label={t('field.category')} required value={form.domaine_id} options={refOptions(refs.domaines, lang)} onChange={(value) => set('domaine_id', value)} />}{entity === 'communes' && <Combobox label={t('field.daira')} required value={form.daira_id} options={refOptions(refs.dairas, lang)} onChange={(value) => set('daira_id', value)} />}{['domaines', 'types'].includes(entity) && <><Input label={t('field.nameAr')} required value={form.name_ar} onChange={(event) => set('name_ar', event.target.value)} /><Input label={t('field.nameFr')} value={form.name_fr} onChange={(event) => set('name_fr', event.target.value)} /></>}{['dairas', 'communes'].includes(entity) && <><Input label={t('field.nameFr')} required value={form.name_fr} onChange={(event) => set('name_fr', event.target.value)} /><Input label={t('field.nameAr')} value={form.name_ar} onChange={(event) => set('name_ar', event.target.value)} /></>}{entity === 'epics' && <><Input label={t('field.name')} required value={form.name} onChange={(event) => set('name', event.target.value)} /><Input label={t('field.acronym')} value={form.sigle} onChange={(event) => set('sigle', event.target.value)} /></>}{entity === 'agents' && <><Input label={t('field.name')} required value={form.full_name} onChange={(event) => set('full_name', event.target.value)} /><Input label={t('field.registration')} value={form.matricule} onChange={(event) => set('matricule', event.target.value)} /><Input label={t('field.phone')} value={form.telephone} onChange={(event) => set('telephone', event.target.value)} /><Combobox label={t('field.daira')} value={form.zone_daira_id} options={refOptions(refs.dairas, lang)} onChange={(value) => set('zone_daira_id', value)} /></>}</div></Dialog></>;
}
