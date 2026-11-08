import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Alert } from '../../components/ui/index.js';
import { useI18n } from '../../i18n/index.jsx';

export default function MiniMap({ value, onChange, tileUrl, interactive = true, className = 'h-64' }) {
  const { t } = useI18n();
  const container = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
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
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, [interactive, tileUrl]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) markerRef.current = L.circleMarker([value.lat, value.lng], { radius: 9, color: 'var(--surface)', weight: 3, fillColor: 'var(--brand-700)', fillOpacity: 1 }).addTo(map);
    else markerRef.current.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14));
  }, [value]);
  return <div><div ref={container} className={`${className} overflow-hidden rounded-md border border-border ${offline ? 'offline-map' : ''}`} />{offline && <Alert variant="warning" className="mt-2">{t('map.tilesDown')}</Alert>}</div>;
}
