import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Bell, Check, ChevronLeft, ChevronRight, CircleAlert, ExternalLink, FilterX, FlaskConical,
  Keyboard, ListX, MapPin, Radar, RefreshCw, RotateCcw, Search, ShieldCheck, X,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@anm/shared';
import { api, queryString } from '../../api/client.js';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import {
  Alert, Button, Card, Dialog, EmptyState, Pagination, PriorityBadge, Tabs, Textarea, useToast,
} from '../../components/ui/index.js';
import QueryContent from '../../components/ui/QueryContent.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApiQuery } from '../../hooks/useApiQuery.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useI18n } from '../../i18n/index.jsx';
import HighlightedText from './HighlightedText.jsx';
import VeilleAlertsPanel from './VeilleAlertsPanel.jsx';

const STATUS_TABS = ['a_qualifier', 'retenu', 'rejete', 'ignore', 'tous'];
const REASONS = ['hors_sujet', 'doublon', 'publicite', 'injure', 'autre'];

function StatusStrip({ status, t }) {
  const item = status?.item;
  if (!item) return null;
  const cards = [
    { icon: CircleAlert, label: t('veille.status.pending'), value: item.a_qualifier },
    { icon: Radar, label: t('veille.status.sources'), value: item.sources },
    { icon: ShieldCheck, label: t('veille.status.alerts'), value: item.alertes_non_lues },
  ];
  return <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{cards.map(({ icon: Icon, label, value }) => (
    <Card key={label} className="flex items-center gap-3 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-800"><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div className="min-w-0"><p className="text-xs font-semibold text-muted">{label}</p><p className="text-lg font-black text-ink">{value}</p></div>
    </Card>))}</div>;
}

function AnalysisPanel({ t, onClose }) {
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const analyze = async () => {
    if (text.trim().length < 3) return;
    setLoading(true); setError(null);
    try { setAnalysis((await api('/veille/analyser', { method: 'POST', body: { texte: text } })).item); }
    catch (cause) { setError(cause.message); } finally { setLoading(false); }
  };
  return <Card className="mb-4 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-bold text-ink">{t('veille.testTitle')}</h2><p className="mt-1 max-w-2xl text-sm text-muted">{t('veille.testHelp')}</p></div>
      <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" aria-hidden="true" />{t('common.close')}</Button>
    </div>
    <Textarea className="mt-3" label={t('veille.detail.originalText')} value={text} maxLength={10000} onChange={(event) => setText(event.target.value)} />
    <div className="mt-3 flex items-center gap-2"><Button loading={loading} disabled={loading || text.trim().length < 3} onClick={analyze}><FlaskConical className="h-4 w-4" aria-hidden="true" />{t('veille.analyze')}</Button>
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}</div>
    {analysis && <div className="mt-4 rounded-md border border-border bg-surface2 p-3 text-sm">
      <p className="font-bold text-ink">{t('veille.analysisResult')} · {t(`veille.langue.${analysis.langue}`)} · score {analysis.score} · {t(`veille.confidence.${analysis.confiance}`)}</p>
      {analysis.correspondances.length ? <div className="mt-2 flex flex-wrap gap-1.5">{analysis.correspondances.map((match) => <span key={`${match.terme}-${match.role}`} className="rounded-full border border-border bg-surface px-2 py-1 text-xs"><bdi>{match.terme}</bdi> · {match.occurrences} × · {t(`veille.role.${match.role}`)}</span>)}</div>
        : <p className="mt-2 text-muted">{t('veille.noMatch')}</p>}
      <ul className="mt-3 grid gap-1">{analysis.suggestions.length ? analysis.suggestions.map((suggestion) => <li key={`${suggestion.groupe_id}-${suggestion.domaine_id}-${suggestion.type_id}`} className="rounded-sm bg-surface px-2 py-1"><bdi>{suggestion.groupe_nom || suggestion.domaine_id}</bdi> · score {suggestion.score} · {t(`veille.confidence.${suggestion.confiance}`)}{suggestion.raisons?.length ? <span className="block text-xs text-muted">{suggestion.raisons.join(' · ')}</span> : null}</li>) : <li className="text-muted">{t('veille.noSuggestion')}</li>}</ul>
    </div>}
  </Card>;
}

export default function VeillePage() {
  const { t, lang } = useI18n(); const { user } = useAuth(); const { push } = useToast(); const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statut = searchParams.get('statut') || 'a_qualifier';
  const groupe = searchParams.get('groupe') || ''; const priorite = searchParams.get('priorite') || '';
  const page = Number(searchParams.get('page') || 1); const pageSize = Number(searchParams.get('pageSize') || 25);
  const [search, setSearch] = useState(''); const term = useDebounced(search, 250);
  const query = useApiQuery(`/veille/elements${queryString({ statut: statut === 'tous' ? undefined : statut, groupe, priorite, q: term, page, pageSize })}`);
  const statusQuery = useApiQuery('/veille/status');
  const refsQuery = useApiQuery('/veille/references');
  const data = query.data || { items: [], total: 0, page, pageSize };
  const items = data.items;
  const [selectedIndex, setSelectedIndex] = useState(0); const [burst, setBurst] = useState(false);
  const [testOpen, setTestOpen] = useState(false); const [prefill, setPrefill] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('hors_sujet'); const [busy, setBusy] = useState(false);
  const writable = user.role !== 'lecteur'; const activeItem = items[selectedIndex];
  const refetch = query.refetch; const refetchStatus = statusQuery.refetch; const refs = refsQuery.data?.item || {};
  const live = useRef({ items, activeItem }); live.current = { items, activeItem };
  useEffect(() => { if (selectedIndex >= items.length) setSelectedIndex(Math.max(0, items.length - 1)); }, [items.length, selectedIndex]);
  useEffect(() => { setSelectedIndex(0); }, [statut, groupe, priorite, term, page, pageSize]);
  const update = useCallback((changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || value === undefined) next.delete(key); else next.set(key, String(value));
    }
    if (!changes.page) next.delete('page');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const decide = useCallback(async (kind, item, reason = 'hors_sujet') => {
    if (!item || busy) return false;
    setBusy(true);
    try {
      const result = await api(`/veille/elements/${item.id}/${kind}`, { method: 'POST', body: kind === 'retenir' ? {} : { raison: reason } });
      if (kind === 'retenir') setPrefill({ id: item.id, values: result.prefill });
      push(t(kind === 'retenir' ? 'veille.toast.retained' : 'veille.toast.rejected'), 'success');
      await Promise.all([refetch(), refetchStatus()]);
      return true;
    } catch (cause) { push(cause.message || t('veille.toast.error'), 'danger'); return false; }
    finally { setBusy(false); }
  }, [busy, push, refetch, refetchStatus, t]);
  const undo = useCallback(async (item) => {
    if (!item || busy) return;
    setBusy(true);
    try { await api(`/veille/elements/${item.id}/annuler`, { method: 'POST' }); push(t('veille.toast.undone'), 'success'); await Promise.all([refetch(), refetchStatus()]); }
    catch (cause) { push(cause.message || t('veille.toast.error'), 'danger'); } finally { setBusy(false); }
  }, [busy, push, refetch, refetchStatus, t]);
  const openPrefilled = useCallback(async (item) => {
    if (!item) return;
    if (item.statut !== 'retenu' && !(await decide('retenir', item))) return;
    navigate(`/anomalies/nouvelle?veille=${item.id}`);
  }, [decide, navigate]);
  useEffect(() => {
    if (!burst) return undefined;
    const handler = (event) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const key = event.key.toLowerCase(); const current = live.current;
      if (!['j', 'k', 'a', 'r', 'd', 'u', 'z', 'e'].includes(key)) return;
      event.preventDefault();
      if (key === 'j') setSelectedIndex((index) => Math.min(index + 1, current.items.length - 1));
      else if (key === 'k') setSelectedIndex((index) => Math.max(index - 1, 0));
      else if (key === 'a') decide('retenir', current.activeItem);
      else if (key === 'r') decide('rejeter', current.activeItem, rejectReason);
      else if (key === 'd') decide('rejeter', current.activeItem, 'doublon');
      else if (key === 'u' || key === 'z') undo(current.activeItem);
      else if (key === 'e') openPrefilled(current.activeItem);
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, [burst, decide, openPrefilled, rejectReason, undo]);
  const tabs = STATUS_TABS.map((value) => ({ value, label: t(`veille.tabs.${value === 'a_qualifier' ? 'aQualifier' : value}`) }));
  const groupOptions = refs.groupes || []; const formatPublished = (value) => value ? (String(value).length > 10 ? formatDateTime(value) : formatDate(value)) : '—';
  return <div className="page-container">
    <PageHeader eyebrow={t('veille.title')} title={t('veille.title')} description={t('veille.purpose')} actions={<>
      <Button variant="secondary" as={Link} to="/veille/tableau"><BarChart3 className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.open')}</Button>
      <Button variant="secondary" onClick={() => setAlertsOpen(true)} aria-label={t('veille.dashboard.alerts')}>
        <Bell className="h-4 w-4" aria-hidden="true" />{t('veille.dashboard.alerts')}
        {statusQuery.data?.item?.alertes_non_lues ? <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-bold text-ink2">{statusQuery.data.item.alertes_non_lues}</span> : null}
      </Button>
      <Button variant="secondary" onClick={() => setTestOpen((open) => !open)}><FlaskConical className="h-4 w-4" aria-hidden="true" />{t('veille.testZone')}</Button>
      {writable && <Button variant={burst ? 'primary' : 'secondary'} onClick={() => setBurst((value) => !value)} aria-pressed={burst}><Keyboard className="h-4 w-4" aria-hidden="true" />{t('veille.keyboard')}</Button>}
      <Button variant="ghost" loading={query.isFetching} onClick={() => { refetch(); refetchStatus(); }}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('common.refresh')}</Button>
    </>} />
    <StatusStrip status={statusQuery.data} t={t} />
    {testOpen && <AnalysisPanel t={t} onClose={() => setTestOpen(false)} />}
    {prefill && <Alert variant="success" title={t('veille.prefillReady')} className="mb-4" action={<Button size="sm" as={Link} to={`/anomalies/nouvelle?veille=${prefill.id}`}>{t('veille.createAnomaly')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>} />}
    <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
      <label className="min-w-56 flex-1 text-sm font-semibold text-ink">{t('veille.search')}
        <span className="relative mt-1 block"><Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-muted" aria-hidden="true" />
          <input className="h-11 w-full rounded-md border border-border bg-surface ps-9 pe-3 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t('veille.search')} /></span></label>
      <label className="min-w-40 text-sm font-semibold text-ink">{t('veille.group')}
        <select className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" value={groupe} onChange={(event) => update({ groupe: event.target.value, page: '' })}>
          <option value="">{t('veille.allGroups')}</option>{groupOptions.map((item) => <option key={item.id} value={item.id}>{lang === 'ar' ? item.name_ar || item.name_fr : item.name_fr}</option>)}
        </select></label>
      <label className="min-w-36 text-sm font-semibold text-ink">{t('veille.priority')}
        <select className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" value={priorite} onChange={(event) => update({ priorite: event.target.value, page: '' })}>
          <option value="">{t('veille.allPriorities')}</option>{['urgente', 'haute', 'normale'].map((value) => <option key={value} value={value}>{t(`priority.${value}`)}</option>)}
        </select></label>
      {(groupe || priorite || term) && <Button variant="ghost" onClick={() => { setSearch(''); update({ groupe: '', priorite: '', page: '' }); }}><FilterX className="h-4 w-4" aria-hidden="true" />{t('common.clearFilters')}</Button>}
    </Card>
    <div className="mb-3"><Tabs ariaLabel={t('veille.title')} value={statut} onChange={(value) => update({ statut: value, page: '' })} tabs={tabs} /></div>
    {burst && <p className="mb-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800" role="status">{t('veille.shortcuts')}</p>}
    <Card className="overflow-hidden"><QueryContent query={query}>
      {items.length ? <><div className="divide-y divide-border">{items.map((item, index) => <article key={item.id} onClick={() => setSelectedIndex(index)}
        className={`p-4 transition ${index === selectedIndex ? 'bg-brand-50' : 'hover:bg-surface2'}`} aria-current={index === selectedIndex ? 'true' : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink2">
              <PriorityBadge value={item.priorite} />
              {item.groupe_nom && <span className="rounded-full bg-surface2 px-2 py-1">{item.groupe_nom}</span>}
              {item.commune_nom && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{item.commune_nom}</span>}
              <span>{item.source_nom}</span>{item.statut !== 'a_qualifier' && <span className="rounded-full border border-border px-2 py-1">{t(`veille.tabs.${item.statut === 'retenu' ? 'retenus' : item.statut === 'rejete' ? 'rejetes' : 'ignores'}`)}</span>}
            </div>
            <HighlightedText text={item.texte} terms={item.termes ? item.termes.split(' · ') : []} className="mt-2 max-h-28 overflow-hidden text-sm text-ink" />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>{formatPublished(item.date_publication)}</span><span>{t('veille.score')} {item.score}</span>
              <span>{t('veille.confidence')} {item.confiance ? t(`veille.confidence.${item.confiance}`) : '—'}</span>
              {item.termes && <span>{t('veille.terms')}: <bdi>{item.termes}</bdi></span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1"><Link className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-brand-700 hover:bg-surface2" to={`/veille/elements/${item.id}`} aria-label={t('veille.view')}><ExternalLink className="h-4 w-4" aria-hidden="true" /></Link></div>
        </div>
        {writable && <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" loading={busy && index === selectedIndex} onClick={(event) => { event.stopPropagation(); decide('retenir', item); }}><Check className="h-4 w-4" aria-hidden="true" />{t('veille.retain')}</Button>
          <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); decide('rejeter', item, rejectReason); }}><X className="h-4 w-4" aria-hidden="true" />{t('veille.reject')}</Button>
          <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); openPrefilled(item); }}><ArrowRight className="h-4 w-4" aria-hidden="true" />{t('veille.edit')}</Button>
        </div>}
      </article>)}</div>
        <Pagination page={page} pageSize={pageSize} total={data.total} onPage={(value) => update({ page: value })} onPageSize={(value) => update({ pageSize: value, page: 1 })} /></>
        : <EmptyState icon={ListX} title={t('veille.empty')} description={t('veille.burstHelp')} />}
    </QueryContent></Card>
    {writable && activeItem && <Card className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 p-3" role="region" aria-label={t('veille.detail.actions')}>
      <div className="flex items-center gap-1"><Button size="sm" variant="ghost" disabled={selectedIndex <= 0} onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))} aria-label={t('veille.previous')}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
        <span className="min-w-20 text-center text-xs text-muted">{selectedIndex + 1} / {items.length}</span>
        <Button size="sm" variant="ghost" disabled={selectedIndex >= items.length - 1} onClick={() => setSelectedIndex((index) => Math.min(items.length - 1, index + 1))} aria-label={t('veille.next')}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></div>
      <Button size="sm" loading={busy} onClick={() => decide('retenir', activeItem)}><Check className="h-4 w-4" aria-hidden="true" />{t('veille.retain')}</Button>
      <select aria-label={t('veille.rejectReason')} className="h-9 rounded-md border border-border bg-surface px-2 text-xs" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)}>
        {REASONS.map((reason) => <option key={reason} value={reason}>{t(`veille.reason.${reason}`)}</option>)}</select>
      <Button size="sm" variant="ghost" loading={busy} onClick={() => decide('rejeter', activeItem, rejectReason)}><X className="h-4 w-4" aria-hidden="true" />{t('veille.reject')}</Button>
      <Button size="sm" variant="ghost" onClick={() => undo(activeItem)}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('veille.undo')}</Button>
      <Button size="sm" variant="ghost" onClick={() => openPrefilled(activeItem)}>{t('veille.edit')}</Button>
      <span className="ms-auto text-xs text-muted">{burst ? t('veille.burstHelp') : t('veille.keyboard')}</span>
    </Card>}
    <Dialog open={alertsOpen} onClose={() => setAlertsOpen(false)} title={t('veille.dashboard.alerts')}>
      <VeilleAlertsPanel onChanged={() => refetchStatus()} />
    </Dialog>
  </div>;
}
