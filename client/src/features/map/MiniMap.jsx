import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Alert } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function MiniMap({ value, onChange, nearby = [], focusGeometry = null, tileUrl, interactive = true, className = 'h-64' }) {
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
    tiles.on('tileerror', () => setOffline(true));
    tiles.addTo(map);
    if (interactive) map.on('click', (event) => onChangeRef.current?.({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) }));
    nearbyLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; nearbyLayerRef.current = null; };
  }, [interactive, tileUrl]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) {
      const icon = L.divIcon({ html: '<span class="smart-map-marker"></span>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
      markerRef.current = L.marker([value.lat, value.lng], { icon, draggable: interactive }).addTo(map);
      markerRef.current.on('dragend', (event) => {
        const point = event.target.getLatLng();
        onChangeRef.current?.({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) });
      });
    }
    else markerRef.current.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
  }, [value, interactive]);
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
  }, [nearby]);
  useEffect(() => {
    const map = mapRef.current;
    geometryLayerRef.current?.remove();
    geometryLayerRef.current = null;
    if (!map || !focusGeometry) return;
    const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: focusGeometry }, {
      style: { color: 'var(--brand-700)', weight: 2, fillColor: 'var(--brand-100)', fillOpacity: 0.18 },
    }).addTo(map);
    geometryLayerRef.current = layer;
    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  }, [focusGeometry]);
  return <div><div ref={container} className={`${className} overflow-hidden rounded-md border border-border ${offline ? 'offline-map' : ''}`} />{offline && <Alert variant="warning" className="mt-2">{t('map.tilesDown')}</Alert>}</div>;
}
