import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../api';

const STATUS_COLORS = {
  non_traite: '#ef4444',
  en_cours: '#f97316',
  traite: '#22c55e',
};

export default function Map() {
  const containerRef = useRef(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const map = L.map(container).setView([36.7538, 3.0588], 12);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    tiles.on('tileerror', () => setTilesFailed(true));

    const divIcon = (color) => L.divIcon({
      className: '',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.6)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    });

    let cancelled = false;

    apiFetch('/anomalies?page=1&pageSize=200')
      .then((d) => {
        if (cancelled) return;
        const items = d.data || [];
        items.forEach((row) => {
          const lat = row.gps_lat;
          const lng = row.gps_lng;
          if (typeof lat !== 'number' || typeof lng !== 'number') return;
          L.marker([lat, lng], { icon: divIcon(STATUS_COLORS[row.statut] || STATUS_COLORS.non_traite) }).addTo(map).bindPopup(
            `<strong>${row.reference}</strong><br/>${row.lien_url}<br/><a href="${row.lien_url}" target="_blank" rel="noopener noreferrer">Ouvrir</a>`,
          );
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      map.remove();
    };
  }, []);

  return (
    <div className="space-y-2">
      {tilesFailed && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-300">
          Fond de carte indisponible hors-ligne — les marqueurs restent actifs.
        </div>
      )}
      <div ref={containerRef} style={{ height: '60vh', width: '100%', background: '#e5e7eb', borderRadius: '0.5rem' }} />
    </div>
  );
}
