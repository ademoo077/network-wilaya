import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { HeatLayer } from 'leaflet.heat';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';
import { Alert, Button } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { watchTileHealth } from './tileHealth.js';
import { fitMap, mapMarker, removeMapLayers } from './mapMarkers.js';

export default function MapCanvas(props) { return <ErrorBoundary><Canvas {...props} /></ErrorBoundary>; }
function Canvas({ items, tileUrl, density, focusId, onSelect, fitRequest }) {
  const { t, lang } = useI18n(); const { theme } = useTheme();
  const node = useRef(null); const mapRef = useRef(null); const markers = useRef(new Map()); const layers = useRef({});
  const select = useRef(onSelect); select.current = onSelect; const lastItems = useRef(null);
  const [offline, setOffline] = useState(false); const [tileAttempt, retryTiles] = useState(0);
  useEffect(() => {
    if (!node.current || mapRef.current) return undefined;
    const map = L.map(node.current, { center: [36.7538, 3.0588], zoom: 11, zoomControl: false, attributionControl: true,
      zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
    const currentMarkers = markers.current;
    mapRef.current = map; map.attributionControl.setPrefix(false);
    const observer = new ResizeObserver(() => { if (mapRef.current === map) map.invalidateSize({ pan: false, animate: false }); });
    observer.observe(node.current);
    return () => {
      observer.disconnect(); mapRef.current = null; map.stop(); removeMapLayers(layers.current);
      map.remove(); currentMarkers.clear(); layers.current = {}; lastItems.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current; if (!map) return undefined;
    const zoom = L.control.zoom({ position: lang === 'ar' ? 'topright' : 'topleft', zoomInTitle: t('map.zoomIn'), zoomOutTitle: t('map.zoomOut') }).addTo(map);
    return () => zoom.remove();
  }, [t, lang]);
  useEffect(() => {
    const map = mapRef.current; if (!map) return undefined;
    const tiles = L.tileLayer(tileUrl, { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    const stop = watchTileHealth(tiles, setOffline); tiles.addTo(map);
    return () => { stop(); tiles.remove(); };
  }, [tileUrl, tileAttempt]);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    removeMapLayers(layers.current); markers.current.clear(); layers.current = {};
    if (density) {
      const tokens = getComputedStyle(document.documentElement);
      layers.current.heat = new HeatLayer(items.map((item) => [item.gps.lat, item.gps.lng, 0.6]), { radius: 28, blur: 18, maxZoom: 16,
        gradient: { 0.2: tokens.getPropertyValue('--brand-700').trim(), 0.6: tokens.getPropertyValue('--st-cours').trim(), 1: tokens.getPropertyValue('--st-non').trim() } }).addTo(map);
      layers.current.selection = L.layerGroup().addTo(map);
    } else {
      layers.current.clusters = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45, animate: false,
        iconCreateFunction: (cluster) => L.divIcon({ html: `<span class="cluster-pin">${cluster.getChildCount()}</span>`, className: 'anomaly-map-cluster', iconSize: [44, 44] }) }).addTo(map);
    }
    for (const [index, item] of items.entries()) {
      const marker = mapMarker(item, index, lang, t); marker.on('click', () => select.current?.(item.id));
      markers.current.set(item.id, marker);
    }
    if (layers.current.clusters) layers.current.clusters.addLayers([...markers.current.values()]);
    if (lastItems.current !== items) { fitMap(map, items); lastItems.current = items; }
  }, [items, density, lang, t, theme]);
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const marker = markers.current.get(focusId?.id); const item = items.find((row) => row.id === focusId?.id);
    layers.current.selection?.clearLayers();
    for (const [id, entry] of markers.current) entry.getElement()?.classList.toggle('map-marker-selected', id === focusId?.id);
    if (!item || !marker) { map.closePopup(); return; }
    const open = () => { if (mapRef.current === map && markers.current.get(item.id) === marker) { marker.openPopup(); marker.getElement()?.classList.add('map-marker-selected'); } };
    if (layers.current.clusters) layers.current.clusters.zoomToShowLayer(marker, open);
    else { layers.current.selection.addLayer(marker); map.setView(marker.getLatLng(), 16, { animate: false }); open(); }
  }, [focusId, items, density, lang, t, theme]);
  useEffect(() => { if (mapRef.current && fitRequest) fitMap(mapRef.current, lastItems.current || []); }, [fitRequest]);
  return <div className="relative h-full min-h-[240px] w-full">
    <div ref={node} data-main-map className="offline-map h-full min-h-[240px] w-full" role="region" aria-label={t('map.title')} />
    {offline && <div className="absolute inset-x-3 bottom-9 z-[500] max-w-lg"><Alert variant="warning" action={<Button size="sm" variant="secondary" onClick={() => retryTiles((value) => value + 1)}>{t('map.retryTiles')}</Button>}>{t('map.tilesDown')}</Alert></div>}
  </div>;
}
