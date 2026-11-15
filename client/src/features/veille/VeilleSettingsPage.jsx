import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Button, Card, Checkbox, EmptyState, Input, Select, Tabs, useToast,
} from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import VeilleSourcesPanel from './VeilleSourcesPanel.jsx';

const EMPTY_ALIAS = { alias: '', commune_id: '', daira_id: '' };
const TYPE_KEYS = { terme_candidat: 'veille.lexicon.candidate', terme_retirer: 'veille.lexicon.removeTerm', alias: 'veille.lexicon.aliasProposal' };
const PARAM_FIELDS = ['veille_conservation_jours', 'veille_seuil_suggestion', 'veille_seuil_pertinent', 'veille_fenetre_doublon_h'];
const SIDEBAR_VISIBILITY_KEY = 'anm-sidebar-items';

const SIDEBAR_ITEMS = [
  { key: 'nav.dashboard', label: 'nav.dashboard' },
  { key: 'nav.anomalies', label: 'nav.anomalies' },
  { key: 'nav.map', label: 'nav.map' },
  { key: 'nav.work', label: 'nav.work' },
  { key: 'nav.report', label: 'nav.report' },
  { key: 'nav.admin', label: 'nav.admin', admin: true },
];

function sidebarItem(key) {
  try {
    const raw = localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
    if (!raw) return true;
    return JSON.parse(raw)[key] !== false;
  } catch { return true; }
}
function saveSidebarVisibility(updates) {
  try {
    const raw = localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
    const current = raw ? { ...JSON.parse(raw) } : {};
    localStorage.setItem(SIDEBAR_VISIBILITY_KEY, JSON.stringify({ ...current, ...updates }));
  } catch { /* stockage indisponible */ }
}

function ParamsPanel() {
  const { t } = useI18n(); const { push } = useToast(); const { user } = useAuth();
  const query = useApiQuery('/veille/settings');
  const [form, setForm] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { if (query.data?.item) setForm({ ...query.data.item }); }, [query.data]);
  const patch = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); if (!form) return; setSaving(true);
    try {
      const body = { ...form };
      for (const key of PARAM_FIELDS) body[key] = Number(body[key]);
      body.veille_activee = Number(form.veille_activee) === 1 ? 1 : 0;
      body.veille_stocker_auteur = Number(form.veille_stocker_auteur) === 1 ? 1 : 0;
      body.veille_pseudonymiser_auteurs = Number(form.veille_pseudonymiser_auteurs) === 1 ? 1 : 0;
      await api('/veille/settings', { method: 'PUT', body });
      push(t('veille.settings.saved'), 'success'); await query.refetch();
    } catch (cause) { push(cause.message, 'danger'); } finally { setSaving(false); }
  };
  return <div className="p-4"><QueryContent query={query}>
    {form && <form onSubmit={save} className="grid max-w-4xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <Checkbox label={t('veille.settings.activation')} checked={Number(form.veille_activee) === 1} onChange={(event) => patch('veille_activee', event.target.checked ? 1 : 0)} />
          <p className="mt-1 text-xs text-muted">{t('veille.settings.activationHelp')}</p>
        </div>
        <Input type="number" min="1" max="3650" label={t('veille.settings.conservation')} hint={t('veille.settings.conservationHelp')} value={form.veille_conservation_jours ?? ''} onChange={(event) => patch('veille_conservation_jours', event.target.value)} />
        <Input type="number" min="1" max="100" label={t('veille.settings.seuilSuggestion')} value={form.veille_seuil_suggestion ?? ''} onChange={(event) => patch('veille_seuil_suggestion', event.target.value)} />
        <Input type="number" min="1" max="100" label={t('veille.settings.seuilPertinent')} value={form.veille_seuil_pertinent ?? ''} onChange={(event) => patch('veille_seuil_pertinent', event.target.value)} />
        <Input type="number" min="1" max="720" label={t('veille.settings.fenetreDoublon')} value={form.veille_fenetre_doublon_h ?? ''} onChange={(event) => patch('veille_fenetre_doublon_h', event.target.value)} />
        <Select label={t('veille.settings.filtreGeo')} value={form.veille_filtre_geo || 'source_ou_lieu'} onChange={(event) => patch('veille_filtre_geo', event.target.value)}
          options={['strict', 'source_ou_lieu', 'aucun'].map((value) => ({ value, label: t(`veille.settings.geo.${value}`) }))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <Checkbox label={t('veille.settings.stockerAuteur')} checked={Number(form.veille_stocker_auteur) === 1} onChange={(event) => patch('veille_stocker_auteur', event.target.checked ? 1 : 0)} />
          <p className="mt-1 text-xs text-muted">{t('veille.settings.stockerAuteurHelp')}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <Checkbox label={t('veille.settings.pseudonymiser')} checked={Number(form.veille_pseudonymiser_auteurs) !== 0} onChange={(event) => patch('veille_pseudonymiser_auteurs', event.target.checked ? 1 : 0)} />
          <p className="mt-1 text-xs text-muted">{t('veille.settings.pseudonymiserHelp')}</p>
        </div>
      </div>
      <div className="rounded-md border border-border p-3">
        <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t('veille.settings.sidebar')}</h3>
        <p className="mt-1 text-xs text-muted">{t('veille.settings.sidebarHelp')}</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {SIDEBAR_ITEMS.filter((item) => !item.admin || user?.role === 'admin').map(({ key, label }) => (
            <div key={key} className="rounded-md border border-border p-2">
              <Checkbox checked={sidebarItem(key)} onChange={(event) => saveSidebarVisibility({ [key]: event.target.checked })}>{t(label)}</Checkbox>
            </div>
          ))}
        </div>
      </div>
      <div><Button type="submit" loading={saving}><Save className="h-4 w-4" aria-hidden="true" />{t('veille.settings.save')}</Button></div>
    </form>}
  </QueryContent></div>;
}

export default function VeilleSettingsPage() {
  const { t, lang } = useI18n(); const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ['lexique', 'lieux', 'apprentissages', 'sources', 'parametres'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'lexique';
  const [tab, setTab] = useState(initialTab); const [search, setSearch] = useState(''); const term = useDebounced(search, 250);
  const selectTab = (value) => {
    setTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'lexique') next.delete('tab'); else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };
  const lexiconQuery = useApiQuery(`/veille/lexique${queryString({ q: term })}`);
  const aliasQuery = useApiQuery('/veille/alias'); const learningQuery = useApiQuery('/veille/apprentissages');
  const refsQuery = useApiQuery('/veille/references'); const refs = refsQuery.data?.item || {};
  const [drafts, setDrafts] = useState({}); const [saving, setSaving] = useState(null); const [alias, setAlias] = useState(EMPTY_ALIAS);
  const lexicon = lexiconQuery.data?.items || []; const aliases = aliasQuery.data?.items || []; const proposals = learningQuery.data?.items || [];
  const groupOptions = useMemo(() => [{ value: '', label: '—' }, ...(refs.groupes || []).map((item) => ({ value: item.id, label: lang === 'ar' ? item.name_ar || item.name_fr : item.name_fr }))], [refs.groupes, lang]);
  const domainOptions = useMemo(() => [{ value: '', label: '—' }, ...(refs.domaines || []).map((item) => ({ value: item.id, label: lang === 'ar' ? item.name_ar || item.name_fr : item.name_fr }))], [refs.domaines, lang]);
  const communeOptions = useMemo(() => [{ value: '', label: '—' }, ...(refs.communes || []).map((item) => ({ value: item.id, label: lang === 'ar' ? item.name_ar || item.name_fr : item.name_fr }))], [refs.communes, lang]);
  const draftFor = (row) => drafts[row.id] || { poids: row.poids, actif: row.actif, groupe_id: row.groupe_id || '', domaine_id: row.domaine_id || '', type_id: row.type_id || '' };
  const edit = (row, key, value) => setDrafts((current) => ({ ...current, [row.id]: { ...draftFor(row), [key]: value } }));
  const saveTerm = async (row) => {
    const draft = draftFor(row); setSaving(row.id);
    try {
      await api(`/veille/lexique/${row.id}`, { method: 'PATCH', body: { poids: Number(draft.poids), actif: Number(draft.actif), groupe_id: draft.groupe_id || null, domaine_id: draft.domaine_id || null, type_id: draft.type_id || null } });
      setDrafts((current) => { const next = { ...current }; delete next[row.id]; return next; }); push(t('veille.lexicon.saved'), 'success'); await lexiconQuery.refetch();
    } catch (cause) { push(cause.message, 'danger'); } finally { setSaving(null); }
  };
  const addAlias = async () => {
    if (alias.alias.trim().length < 2) return;
    try {
      await api('/veille/alias', { method: 'POST', body: { alias: alias.alias.trim(), commune_id: alias.commune_id || null, daira_id: alias.daira_id || null } });
      setAlias(EMPTY_ALIAS); push(t('veille.toast.aliasAdded'), 'success'); await aliasQuery.refetch();
    } catch (cause) { push(cause.message, 'danger'); }
  };
  const removeAlias = async (id) => {
    try { await api(`/veille/alias/${id}`, { method: 'DELETE' }); push(t('veille.toast.aliasDeleted'), 'success'); await aliasQuery.refetch(); }
    catch (cause) { push(cause.message, 'danger'); }
  };
  const refreshLearning = async () => {
    try { await api('/veille/apprentissages/rafraichir', { method: 'POST' }); push(t('veille.toast.refreshed'), 'success'); await learningQuery.refetch(); }
    catch (cause) { push(cause.message, 'danger'); }
  };
  const decideLearning = async (id, accept) => {
    try { await api(`/veille/apprentissages/${id}/${accept ? 'accepter' : 'refuser'}`, { method: 'POST' }); push(t('veille.toast.learned'), 'success'); await Promise.all([learningQuery.refetch(), lexiconQuery.refetch()]); }
    catch (cause) { push(cause.message, 'danger'); }
  };
  return <div className="page-container">
    <PageHeader title={t('veille.lexicon.title')} description={t('veille.lexicon.subtitle')} />
    <Card className="mb-4"><Tabs ariaLabel={t('veille.lexicon.title')} value={tab} onChange={selectTab} tabs={[
      { value: 'lexique', label: t('veille.lexicon.term') }, { value: 'lieux', label: t('veille.lexicon.aliases') },
      { value: 'apprentissages', label: `${t('veille.lexicon.proposals')} (${proposals.filter((item) => item.statut === 'propose').length})` },
      { value: 'sources', label: t('veille.sources.tab') },
      { value: 'parametres', label: t('veille.settings.tab') },
    ]} />
      {tab === 'lexique' && <div className="p-4">
        <div className="mb-4 flex flex-wrap items-end gap-3"><Input className="min-w-64 flex-1" label={t('veille.lexicon.search')} value={search} onChange={(event) => setSearch(event.target.value)} /><Button variant="ghost" loading={lexiconQuery.isFetching} onClick={() => lexiconQuery.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('common.refresh')}</Button></div>
        <QueryContent query={lexiconQuery}>{lexicon.length ? <ul className="grid gap-2">{lexicon.map((row) => { const draft = draftFor(row); return <li key={row.id} className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-ink"><bdi>{row.terme}</bdi></p><p className="text-xs text-muted">{t('veille.lexicon.role')}: {t(`veille.role.${row.role}`)} · {t(`veille.langue.${row.langue}`)} · {row.groupe_nom || row.domaine_nom || '—'}</p></div>
            <span className="text-xs text-muted">{t('veille.lexicon.weight')} {row.poids}</span></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <label className="text-xs font-semibold text-muted">{t('veille.lexicon.weight')}<input type="number" min="-5" max="5" className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-2 text-sm" value={draft.poids} onChange={(event) => edit(row, 'poids', event.target.value)} /></label>
            <Select label={t('veille.lexicon.group')} value={draft.groupe_id} onChange={(event) => edit(row, 'groupe_id', event.target.value)} options={groupOptions} />
            <Select label={t('veille.lexicon.domain')} value={draft.domaine_id} onChange={(event) => edit(row, 'domaine_id', event.target.value)} options={domainOptions} />
            <div className="flex items-end gap-2"><Checkbox label={t('veille.lexicon.active')} checked={Number(draft.actif) === 1} onChange={(event) => edit(row, 'actif', event.target.checked ? 1 : 0)} /><Button size="sm" loading={saving === row.id} onClick={() => saveTerm(row)}><Save className="h-4 w-4" aria-hidden="true" />{t('veille.lexicon.save')}</Button></div>
          </div></li>; })}</ul> : <EmptyState icon={X} title={t('veille.empty')} />}</QueryContent>
      </div>}
      {tab === 'lieux' && <div className="p-4"><Card className="mb-4 p-4"><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input label={t('veille.lexicon.alias')} value={alias.alias} onChange={(event) => setAlias({ ...alias, alias: event.target.value })} />
        <Select label={t('veille.commune')} value={alias.commune_id} onChange={(event) => setAlias({ ...alias, commune_id: event.target.value })} options={communeOptions} />
        <Select label={t('field.daira')} value={alias.daira_id} onChange={(event) => setAlias({ ...alias, daira_id: event.target.value })} options={[{ value: '', label: '—' }, ...(refs.dairas || []).map((item) => ({ value: item.id, label: lang === 'ar' ? item.name_ar || item.name_fr : item.name_fr }))]} />
        <div className="flex items-end"><Button onClick={addAlias}><Plus className="h-4 w-4" aria-hidden="true" />{t('veille.lexicon.addAlias')}</Button></div>
      </div></Card>
        <QueryContent query={aliasQuery}>{aliases.length ? <ul className="grid gap-2">{aliases.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"><span><bdi className="font-semibold">{row.alias}</bdi> <span className="text-muted">· {row.commune_nom || row.daira_nom || '—'} · {row.origine}</span></span><Button size="sm" variant="ghost" onClick={() => removeAlias(row.id)}><Trash2 className="h-4 w-4" aria-hidden="true" />{t('veille.lexicon.deleteAlias')}</Button></li>)}</ul> : <EmptyState icon={X} title={t('veille.empty')} />}</QueryContent></div>}
      {tab === 'apprentissages' && <div className="p-4"><div className="mb-4 flex justify-end"><Button variant="secondary" onClick={refreshLearning}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('veille.lexicon.refreshLearning')}</Button></div>
        <QueryContent query={learningQuery}>{proposals.length ? <ul className="grid gap-2">{proposals.map((row) => <li key={row.id} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-ink"><bdi>{row.terme}</bdi></p><p className="text-xs text-muted">{t(TYPE_KEYS[row.type] || 'veille.lexicon.proposals')} · {row.occurrences} {t('veille.lexicon.occurrences')} · {t('veille.lexicon.precision')} {row.precision === null ? '—' : `${Math.round(Number(row.precision) * 100)} %`} · {t(`veille.langue.${row.langue || 'mix'}`)}</p></div><span className="rounded-full bg-surface2 px-2 py-1 text-xs font-bold text-ink2">{row.statut}</span></div>
          {row.statut === 'propose' && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => decideLearning(row.id, true)}><Check className="h-4 w-4" aria-hidden="true" />{t('veille.lexicon.accept')}</Button><Button size="sm" variant="ghost" onClick={() => decideLearning(row.id, false)}><X className="h-4 w-4" aria-hidden="true" />{t('veille.lexicon.refuse')}</Button></div>}</li>)}</ul> : <EmptyState icon={Check} title={t('veille.lexicon.noProposals')} />}</QueryContent></div>}
      {tab === 'sources' && <VeilleSourcesPanel />}
      {tab === 'parametres' && <ParamsPanel />}
    </Card>
  </div>;
}
