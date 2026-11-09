import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ListFilter, MapPin } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet.markercluster';
import { addDays, formatDate, weekStart } from '@anm/shared';
import { api, queryString, anomalyListSchema, emptyAnomalyList } from '../../api/client.js';
import { Alert, Card, Checkbox, EmptyState, IconButton, Select, StatusBadge } from '../../components/ui/index.js';
import { useRefs } from '../../context/RefsContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { anomalyLabel } from '../anomalies/helpers.js';

async function loadAll(filters) {
  const first = await api(`/anomalies${queryString({ ...filters, page: 1, pageSize: 200 })}`, { schema: anomalyListSchema, fallback: emptyAnomalyList });
  const items = [...(first?.items ?? [])];
  const pages = Math.ceil(first.total / 200);
  for (let page = 2; page <= pages; page += 1) {
    const response = await api(`/anomalies${queryString({ ...filters, page, pageSize: 200 })}`);
    items.push(...response.items);
  }
  return items.filter((item) => item.gps);
}

export default function MapPage() {
  const { t, lang, dir } = useI18n();
  const { refs } = useRefs();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [panel, setPanel] = useState(true);
  const [weekOnly, setWeekOnly] = useState(false);
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const clustersRef = useRef(null);
  const markersRef = useRef(new Map());
  const filters = useMemo(() => Object.fromEntries(params.entries()), [params]);
  useEffect(() => {
    const query = { ...filters };
    if (weekOnly) { query.from = weekStart(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date()), Number(refs.parametres.week_start_day) || 0); query.to = addDays(query.from, 6); }
    setLoading(true);
    loadAll(query).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [filters, refs.parametres.week_start_day, weekOnly]);
  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;
    const map = L.map(mapNode.current, { center: [36.7538, 3.0588], zoom: 11, attributionControl: true });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('© OpenStreetMap contributors');
    const tiles = L.tileLayer(refs.parametres.tile_url, { maxZoom: 19 });
    tiles.on('tileerror', () => setOffline(true));
    tiles.addTo(map);
    const clusters = L.markerClusterGroup({
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => L.divIcon({ html: `<span class="cluster-pin">${cluster.getChildCount()}</span>`, className: '', iconSize: [40, 40] }),
    });
    clusters.addTo(map);
    clustersRef.current = clusters;
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; clustersRef.current = null; };
  }, [refs.parametres.tile_url]);
  useEffect(() => {
    const clusters = clustersRef.current;
    const map = mapRef.current;
    if (!clusters || !map) return;
    clusters.clearLayers(); markersRef.current.clear();
    items.forEach((item, index) => {
      const icon = L.divIcon({ html: `<span class="map-pin ${item.statut}"><span>${index + 1}</span></span>`, className: '', iconSize: [32, 32], iconAnchor: [16, 32] });
      const marker = L.marker([item.gps.lat, item.gps.lng], { icon });
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = item.reference;
      const text = document.createElement('p'); text.textContent = anomalyLabel(item, 'type', lang);
      const link = document.createElement('button'); link.textContent = t('anomalies.openSheet'); link.className = 'mt-2 font-bold text-brand-700'; link.onclick = () => navigate(`/anomalies/${item.id}`);
      popup.append(title, text, link); marker.bindPopup(popup); clusters.addLayer(marker); markersRef.current.set(item.id, marker);
    });
    if (items.length) map.fitBounds(L.latLngBounds(items.map((item) => [item.gps.lat, item.gps.lng])), { padding: [32, 32], maxZoom: 15 });
  }, [items, lang, navigate, t]);
  useEffect(() => { window.setTimeout(() => mapRef.current?.invalidateSize(), 220); }, [panel, theme]);
  useEffect(() => {
    const node = mapNode.current;
    const map = mapRef.current;
    if (!node || !map) return undefined;
    const observer = new ResizeObserver(() => { map.invalidateSize(); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const setFilter = (key, value) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const focus = (item) => { const marker = markersRef.current.get(item.id); mapRef.current?.setView([item.gps.lat, item.gps.lng], 16); marker?.openPopup(); };
  return <div className="relative flex h-[calc(100dvh-4rem)] min-w-0 overflow-hidden"><aside className={`${panel ? 'w-full sm:w-96' : 'w-0'} z-20 shrink-0 overflow-hidden border-e border-border bg-surface transition-[width] duration-200`}><div className="flex h-full w-full min-w-[320px] flex-col sm:w-96"><div className="border-b border-border p-4"><h1 className="text-xl font-black">{t('map.title')}</h1><p className="mt-1 text-xs text-muted">{t('map.visible', { count: items.length })}</p><div className="mt-4 grid grid-cols-2 gap-2"><Select label={t('field.status')} placeholder={t('common.all')} value={filters.statut || ''} options={['non_traite', 'en_cours', 'traite'].map((value) => ({ value, label: t(`status.${value}`) }))} onChange={(event) => setFilter('statut', event.target.value)} /><Select label={t('field.priority')} placeholder={t('common.all')} value={filters.priorite || ''} options={['normale', 'haute', 'urgente'].map((value) => ({ value, label: t(`priority.${value}`) }))} onChange={(event) => setFilter('priorite', event.target.value)} /></div><Checkbox label={t('dashboard.thisWeek')} checked={weekOnly} onChange={(event) => setWeekOnly(event.target.checked)} /></div><div className="min-h-0 flex-1 overflow-y-auto">{loading ? <p className="p-4 text-sm text-muted">{t('common.loading')}</p> : items.length ? items.map((item, index) => <button key={item.id} className="flex w-full items-start gap-3 border-b border-border p-4 text-start hover:bg-surface2" onClick={() => focus(item)}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{index + 1}</span><span className="min-w-0 flex-1"><bdi className="font-bold text-brand-700">{item.reference}</bdi><span className="mt-1 block truncate text-sm"><bdi>{anomalyLabel(item, 'type', lang)}</bdi></span><span className="mt-1 block text-xs text-muted">{formatDate(item.date_signalement)}</span></span><StatusBadge value={item.statut} /></button>) : <EmptyState icon={MapPin} title={t('map.noGps')} compact />}</div></div></aside><div className="relative min-w-0 flex-1"><div ref={mapNode} className={`h-full w-full ${offline ? 'offline-map' : ''}`} /><IconButton className="absolute start-3 top-3 z-[500] bg-surface shadow-2" aria-label={panel ? t('nav.collapse') : t('nav.expand')} onClick={() => setPanel((value) => !value)}>{panel ? dir === 'rtl' ? <ChevronRight /> : <ChevronLeft /> : <ListFilter />}</IconButton>{offline && <Alert variant="warning" className="absolute bottom-4 start-4 end-4 z-[500] sm:end-auto">{t('map.tilesDown')}</Alert>}<Card className="absolute bottom-4 end-4 z-[500] hidden p-3 sm:block"><p className="text-xs font-bold">{t('map.legend')}</p><div className="mt-2 flex gap-3">{['non_traite', 'en_cours', 'traite'].map((status) => <StatusBadge key={status} value={status} />)}</div></Card></div></div>;
}
