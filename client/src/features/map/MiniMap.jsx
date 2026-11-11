import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { DEFAULT_PARAMS, formatGps } from '@anm/shared';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';
import { Alert } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';
import { watchTileHealth } from './tileHealth.js';

export default function MiniMap(props) { return <ErrorBoundary><MiniMapContent {...props} /></ErrorBoundary>; }

function MiniMapContent({ value, onChange, nearby = [], focusGeometry = null, tileUrl = DEFAULT_PARAMS.tile_url, interactive = true, className = 'h-64' }) {
  const { t } = useI18n();
  const container = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const nearbyLayerRef = useRef(null);
  const geometryLayerRef = useRef(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!container.current || mapRef.current) return undefined;
    const map = L.map(container.current, { center: [36.7538, 3.0588], zoom: 11, attributionControl: true, zoomControl: true });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution('© OpenStreetMap contributors');
    const tiles = L.tileLayer(tileUrl, { maxZoom: 19 });
    const stopTiles = watchTileHealth(tiles, setOffline);
    tiles.addTo(map);
    if (interactive) map.on('click', (event) => onChangeRef.current?.({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) }));
    nearbyLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const observer = new ResizeObserver(() => { if (mapRef.current === map) map.invalidateSize({ pan: false }); });
    observer.observe(container.current);
    return () => {
      observer.disconnect(); stopTiles();
      mapRef.current = null;
      map.remove();
      markerRef.current = null; nearbyLayerRef.current = null; geometryLayerRef.current = null;
    };
  }, [interactive, tileUrl]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return; }
    const label = `${t('field.gps')} : ${formatGps(value.lat, value.lng)}`;
    if (!markerRef.current) {
      const icon = L.divIcon({ html: '<span class="smart-map-marker"></span>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
      markerRef.current = L.marker([value.lat, value.lng], { icon, draggable: interactive, title: label }).addTo(map);
      markerRef.current.on('dragend', (event) => {
        const point = event.target.getLatLng();
        onChangeRef.current?.({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) });
      });
    }
    else markerRef.current.setLatLng([value.lat, value.lng]);
    markerRef.current.getElement()?.setAttribute('aria-label', label);
    markerRef.current.getElement()?.setAttribute('title', label);
    map.setView([value.lat, value.lng], 16, { animate: false });
  }, [value, interactive, tileUrl, t]);
  useEffect(() => {
    const layer = nearbyLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    nearby.forEach((item) => {
      L.circleMarker([item.gps.lat, item.gps.lng], {
        radius: 7, color: 'var(--surface)', weight: 2,
        fillColor: item.statut === 'traite' ? 'var(--st-traite)' : item.statut === 'en_cours' ? 'var(--st-cours)' : 'var(--st-non)',
        fillOpacity: 0.55,
      }).bindTooltip(item.reference).addTo(layer);
    });
  }, [nearby, interactive, tileUrl]);
  useEffect(() => {
    const map = mapRef.current;
    geometryLayerRef.current?.remove();
    geometryLayerRef.current = null;
    if (!map || !focusGeometry) return;
    const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: focusGeometry }, {
      style: { color: 'var(--brand-700)', weight: 2, fillColor: 'var(--brand-100)', fillOpacity: 0.18 },
    }).addTo(map);
    geometryLayerRef.current = layer;
    if (!markerRef.current && layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 16 });
  }, [focusGeometry, interactive, tileUrl]);
  return <div><div ref={container} role="region" aria-label={t('field.gps')} className={`${className} offline-map overflow-hidden rounded-md border border-border`} />{offline && <Alert variant="warning" className="mt-2">{t('map.tilesDown')}</Alert>}</div>;
}
