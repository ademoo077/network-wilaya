import { useMemo, useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Expand, ListFilter, List, LoaderCircle, MapPin, Plus, RefreshCw, Shrink } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, queryString } from '../../api/client.js';
import { Button, IconButton } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useRefs } from '../../context/RefsContext.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useI18n } from '../../i18n/index.jsx';
import MapCanvas from './MapCanvas.jsx';
import MapFilters from './MapFilters.jsx';
import MapResults from './MapResults.jsx';

export default function MapPage() {
  const { t } = useI18n(); const { refs } = useRefs(); const { user } = useAuth(); const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState(true); const [expanded, setExpanded] = useState(false);
  const [density, setDensity] = useState(false); const [focusId, setFocusId] = useState(null); const [fitRequest, fitAll] = useState(0);
  const shell = useRef(null);
  const filters = useMemo(() => Object.fromEntries(params.entries()), [params]); const search = useDebounced(filters.q || '');
  const query = useMemo(() => ({ ...filters, q: search || undefined }), [filters, search]);
  const result = useQuery({ queryKey: ['map-anomalies', query], queryFn: ({ signal }) => api(`/anomalies/map${queryString(query)}`, { signal }), placeholderData: keepPreviousData });
  const items = result.data?.items || []; const selectedId = items.some((item) => item.id === focusId?.id) ? focusId.id : null;
  const busy = result.isFetching || (filters.q || '') !== search;
  const setFilter = (key, value, extra = {}) => {
    const next = new URLSearchParams(params);
    for (const [name, entry] of Object.entries({ [key]: value, ...extra })) { if (entry) next.set(name, entry); else next.delete(name); }
    next.delete('page'); setParams(next, { replace: true });
  };
  const select = (id) => {
    setFocusId({ id, at: Date.now() });
    if (window.innerWidth < 768) setPanel(false);
  };
  return <section ref={shell} data-map-page className={`flex min-w-0 flex-col overflow-hidden bg-surface ${expanded ? 'fixed inset-0 z-[1000] h-dvh' : 'relative h-[calc(100dvh-4rem)] min-h-[620px]'}`}
    onKeyDown={(event) => { if (event.key === 'Escape' && expanded) { setExpanded(false); shell.current?.querySelector('[data-expand-map]')?.focus(); } }}>
    <header className="z-20 shrink-0 border-b border-border bg-surface px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><h1 className="text-xl font-black text-ink sm:text-2xl">{t('map.title')}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted" aria-live="polite">{busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-label={t('common.loading')} />}
            {t('map.located', { count: items.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" aria-expanded={panel} aria-controls="map-panel" onClick={() => setPanel(!panel)}><ListFilter className="h-4 w-4" />{t('common.filters')}</Button>
          <IconButton aria-label={t('map.fitAll')} title={t('map.fitAll')} onClick={() => { setFocusId(null); fitAll((value) => value + 1); }}><MapPin className="h-5 w-5" /></IconButton>
          <IconButton aria-label={t('common.refresh')} title={t('common.refresh')} disabled={busy} onClick={() => result.refetch()}><RefreshCw className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} /></IconButton>
          <IconButton data-expand-map aria-label={t(expanded ? 'map.exitExpanded' : 'map.expand')} title={t(expanded ? 'map.exitExpanded' : 'map.expand')} onClick={() => setExpanded(!expanded)}>{expanded ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}</IconButton>
          <Button as={Link} to={`/anomalies${queryString(filters)}`} variant="secondary" aria-label={t('map.openList')}><List className="h-4 w-4" /><span className="hidden xl:inline">{t('map.openList')}</span></Button>
          {user.role !== 'lecteur' && <Button as={Link} to="/anomalies/nouvelle" aria-label={t('form.newTitle')}><Plus className="h-4 w-4" /><span className="hidden xl:inline">{t('form.newTitle')}</span></Button>}
        </div>
      </div>
      {result.data?.missing > 0 && <Link className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface2 px-3 text-xs font-semibold text-brand-700 underline" to={`/anomalies${queryString({ ...filters, gps: 'absent' })}`}>
        <MapPin className="h-4 w-4 shrink-0" />{t('map.missing', { count: result.data.missing })}</Link>}
    </header>
    <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
      {panel && <aside id="map-panel" aria-label={t('map.filtersAndList')} className="z-20 flex max-h-[58%] min-h-0 w-full shrink-0 flex-col border-b border-border bg-surface shadow-1 md:max-h-full md:w-[340px] md:border-b-0 md:border-e">
        <div className="max-h-[65%] shrink-0 overflow-auto border-b border-border md:max-h-[68%]"><MapFilters {...{ filters, setFilter, refs, density, setDensity }} reset={() => setParams({}, { replace: true })} /></div>
        <div className="min-h-0 flex-1 overflow-auto" aria-busy={busy}><MapResults {...{ result, selectedId }} onSelect={select} /></div>
      </aside>}
      <div className="min-h-[240px] min-w-0 flex-1"><MapCanvas {...{ items, density, fitRequest }} focusId={selectedId ? focusId : null} onSelect={select} tileUrl={refs.parametres.tile_url} /></div>
    </div>
  </section>;
}
