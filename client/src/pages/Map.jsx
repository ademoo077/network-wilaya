import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../api';

const STATUS_COLORS = { non_traite: '#dc2626', en_cours: '#d97706', traite: '#059669' };
const STATUS_LABELS = { non_traite: 'Non traité', en_cours: 'En cours', traite: 'Traité' };

export default function Map() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  const [filterStatut, setFilterStatut] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    apiFetch('/anomalies?page=1&pageSize=200').then((d) => setAnomalies(d.data || [])).catch(() => {});
  }, []);

  const visible = anomalies.filter((a) => (!filterStatut || a.statut === filterStatut) && typeof a.gps_lat === 'number' && typeof a.gps_lng === 'number');

  const [tileUrl, setTileUrl] = useState('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}');

  useEffect(() => {
    apiFetch('/config').then((d) => { if (d?.tileUrl) setTileUrl(d.tileUrl); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const map = L.map(container).setView([36.7538, 3.0588], 11);
    mapRef.current = map;
    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '© OpenStreetMap © CARTO © Esri',
    });
    tiles.on('tileerror', () => setTilesFailed(true));
    L.control.attribution({ prefix: false }).addTo(map);
    tiles.addTo(map);

    setMapReady(true);

    return () => { map.remove(); mapRef.current = null; setMapReady(false); };
  }, [tileUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    const group = L.featureGroup();
    visible.forEach((row) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${STATUS_COLORS[row.statut] || STATUS_COLORS.non_traite};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.6)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -7],
      });
      const m = L.marker([row.gps_lat, row.gps_lng], { icon }).addTo(map);
      m.bindPopup(`<strong>${row.reference}</strong><br/>${row.lien_url}<br/><a href="${row.lien_url}" target="_blank" rel="noopener noreferrer">Ouvrir la fiche</a>`);
      markersRef.current.push(m);
      group.addLayer(m);
    });
    if (visible.length > 0) {
      try { map.fitBounds(group.getBounds().pad(0.2)); } catch { /* ignore */ }
    }
  }, [visible, tileUrl, mapReady]);

  function centerOn(a) {
    const map = mapRef.current;
    if (map && typeof a.gps_lat === 'number') map.setView([a.gps_lat, a.gps_lng], 15);
  }

  function useMyPosition() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const map = mapRef.current;
      if (map) map.setView([pos.coords.latitude, pos.coords.longitude], 15);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-[calc(100dvh-140px)]">
      <div className="relative rounded-[var(--r-lg)] overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
        {tilesFailed && (
          <div className="absolute top-3 left-3 right-3 z-[1000] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] p-3 text-sm text-[var(--ink-2)] shadow-[var(--shadow-2)]">
            Fond de carte indisponible — vérifiez le paramètre <code>tile_url</code> (Administration). Les marqueurs restent actifs.
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
        <div className="absolute bottom-3 start-3 z-[1000] bg-[var(--surface)]/90 backdrop-blur rounded-[var(--r-md)] px-3 py-2 text-xs border border-[var(--border)]">
          <div className="font-semibold mb-1">Légende</div>
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: v }} /> {STATUS_LABELS[k]}</div>
          ))}
          <div className="mt-1 text-[var(--muted)]">{visible.length} anomalie(s) sur la carte</div>
        </div>
        <button onClick={useMyPosition} className="absolute top-3 end-3 z-[1000] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] px-3 py-2 text-xs shadow-[var(--shadow-1)]">
          Ma position
        </button>
      </div>
      <div className={`bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] flex flex-col ${panelOpen ? '' : 'hidden lg:flex'}`}>
        <div className="p-3 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)]">Anomalies ({visible.length})</h3>
          <button onClick={() => setPanelOpen((v) => !v)} className="text-xs text-[var(--muted)]">{panelOpen ? 'Masquer' : 'Afficher'}</button>
        </div>
        <div className="p-3 border-b border-[var(--border)]">
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="h-9 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
            <option value="">Tous les statuts</option>
            <option value="non_traite">Non traité</option>
            <option value="en_cours">En cours</option>
            <option value="traite">Traité</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {visible.map((a) => (
            <button key={a.id} onClick={() => centerOn(a)} className="w-full text-start p-2 rounded-[var(--r-md)] hover:bg-[var(--brand-50)] border border-transparent hover:border-[var(--border)]">
              <div className="text-xs font-mono text-[var(--muted)]">{a.reference}</div>
              <div className="text-sm text-[var(--ink)] truncate">{a.lien_url}</div>
              <div className="text-xs" style={{ color: STATUS_COLORS[a.statut] }}>{STATUS_LABELS[a.statut]}</div>
            </button>
          ))}
          {visible.length === 0 && <div className="text-sm text-[var(--muted)] p-2">Aucune anomalie géolocalisée</div>}
        </div>
      </div>
    </div>
  );
}