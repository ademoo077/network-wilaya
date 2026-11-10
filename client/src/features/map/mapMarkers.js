import L from 'leaflet';
import { formatDate, formatGps } from '@anm/shared';
import { anomalyLabel } from '../anomalies/helpers.js';

export function mapMarker(item, index, lang, t) {
  const icon = L.divIcon({ html: `<span class="map-pin ${item.statut}"><span>${index + 1}</span></span>`, className: 'anomaly-map-marker', iconSize: [44, 44], iconAnchor: [22, 40] });
  const marker = L.marker([item.gps.lat, item.gps.lng], { icon, title: item.reference, alt: item.reference });
  const popup = document.createElement('div'); popup.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const title = document.createElement('strong'); title.textContent = item.reference;
  const type = document.createElement('p'); type.textContent = anomalyLabel(item, 'type', lang);
  const place = document.createElement('p'); place.textContent = anomalyLabel(item, 'commune', lang);
  const status = document.createElement('p'); status.textContent = `${t(`status.${item.statut}`)} · ${formatDate(item.date_signalement)}`;
  const gps = document.createElement('p'); gps.dir = 'ltr'; gps.textContent = formatGps(item.gps.lat, item.gps.lng); gps.className = 'text-xs text-muted';
  const link = document.createElement('a'); link.textContent = t('anomalies.openSheet'); link.href = `#/anomalies/${item.id}`;
  link.className = 'inline-flex min-h-11 items-center font-bold text-brand-700 underline';
  popup.append(title, type, place, status, gps, link); marker.bindPopup(popup, { maxWidth: 280 });
  return marker;
}

export function fitMap(map, items) {
  if (items.length) map.fitBounds(L.latLngBounds(items.map((item) => [item.gps.lat, item.gps.lng])), { padding: [44, 44], maxZoom: 16, animate: false });
  else map.setView([36.7538, 3.0588], 11, { animate: false });
}

export function removeMapLayers(layers) {
  for (const layer of Object.values(layers)) layer.remove();
}
