import { useState } from 'react';
import { Bike, Building2 } from 'lucide-react';
import { api } from '../../api/client.js';
import { Button, Card, Checkbox, EmptyState, Input, Select, useToast } from '../../components/ui/index.js';
import { refLabel, useI18n } from '../../i18n/index.jsx';
import { useRefs } from '../../context/RefsContext.jsx';

export function EpicStep() {
  const { t, lang } = useI18n();
  const { refs, reload } = useRefs();
  const { push } = useToast();
  const [form, setForm] = useState({ name: '', sigle: '', domaine_ids: [] });
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true);
    try {
      await api('/ref/epics', { method: 'POST', body: form });
      setForm({ name: '', sigle: '', domaine_ids: [] }); await reload(); push(t('common.success'));
    } catch (error) { push(error.message, 'danger'); } finally { setLoading(false); }
  };
  const toggle = (id) => setForm((current) => ({ ...current, domaine_ids: current.domaine_ids.includes(id) ? current.domaine_ids.filter((value) => value !== id) : [...current.domaine_ids, id] }));
  return <div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><form className="space-y-4" onSubmit={submit}><Input label={t('field.name')} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input label={t('field.acronym')} value={form.sigle} onChange={(event) => setForm({ ...form, sigle: event.target.value })} /><fieldset><legend className="mb-2 text-sm font-bold text-ink">{t('field.category')}</legend><div className="max-h-72 overflow-auto rounded-md border border-border p-2">{refs.domaines.map((domain) => <Checkbox key={domain.id} label={<bdi>{refLabel(domain, lang)}</bdi>} checked={form.domaine_ids.includes(domain.id)} onChange={() => toggle(domain.id)} className="flex w-full" />)}</div></fieldset><div className="flex justify-end"><Button type="submit" loading={loading}>{t('common.add')}</Button></div></form></Card><Card>{refs.epics.length ? <ul className="divide-y divide-border">{refs.epics.map((epic) => <li key={epic.id} className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-md bg-brand-100 text-brand-800"><Building2 className="h-5 w-5" /></span><div><p className="font-bold"><bdi>{epic.name}</bdi></p><p className="text-xs text-muted"><bdi>{epic.sigle || '—'}</bdi></p></div></li>)}</ul> : <EmptyState icon={Building2} title={t('common.noData')} compact />}</Card></div>;
}

export function AgentStep() {
  const { t, lang } = useI18n();
  const { refs, reload } = useRefs();
  const { push } = useToast();
  const [form, setForm] = useState({ full_name: '', matricule: '', telephone: '', zone_daira_id: '' });
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true);
    try {
      await api('/ref/agents', { method: 'POST', body: { ...form, zone_daira_id: form.zone_daira_id || null } });
      setForm({ full_name: '', matricule: '', telephone: '', zone_daira_id: '' }); await reload(); push(t('common.success'));
    } catch (error) { push(error.message, 'danger'); } finally { setLoading(false); }
  };
  return <div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}><Input className="sm:col-span-2" label={t('field.name')} required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /><Input label={t('field.registration')} value={form.matricule} onChange={(event) => setForm({ ...form, matricule: event.target.value })} /><Input label={t('field.phone')} value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} /><Select className="sm:col-span-2" label={t('field.daira')} placeholder={t('common.choose')} options={refs.dairas.map((item) => ({ value: item.id, label: refLabel(item, lang) }))} value={form.zone_daira_id} onChange={(event) => setForm({ ...form, zone_daira_id: event.target.value })} /><div className="sm:col-span-2 flex justify-end"><Button type="submit" loading={loading}>{t('common.add')}</Button></div></form></Card><Card>{refs.agents.length ? <ul className="divide-y divide-border">{refs.agents.map((agent) => <li key={agent.id} className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-md bg-brand-100 text-brand-800"><Bike className="h-5 w-5" /></span><div><p className="font-bold"><bdi>{agent.full_name}</bdi></p><p className="text-xs text-muted"><bdi>{agent.matricule || '—'} · {agent.telephone || '—'}</bdi></p></div></li>)}</ul> : <EmptyState icon={Bike} title={t('common.noData')} compact />}</Card></div>;
}
