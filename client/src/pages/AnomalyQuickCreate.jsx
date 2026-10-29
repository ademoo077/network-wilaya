import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';

function detectPlatform(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('x.com') || u.includes('twitter.com')) return 'x';
  if (u.includes('t.me') || u.includes('telegram')) return 'telegram';
  if (u.includes('wa.me') || u.includes('whatsapp')) return 'whatsapp';
  return 'autre';
}

function parseGps(input) {
  if (!input) return null;
  const s = String(input).trim();
  const direct = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (direct) return { lat: Number(direct[1]), lng: Number(direct[2]) };
  const atMatch = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  const qMatch = s.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  const llMatch = s.match(/ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (llMatch) return { lat: Number(llMatch[1]), lng: Number(llMatch[2]) };
  const osmMatch = s.match(/#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (osmMatch) return { lat: Number(osmMatch[1]), lng: Number(osmMatch[2]) };
  return null;
}

export default function AnomalyQuickCreate({ onCreated }) {
  const { t } = useI18n();
  const [lien, setLien] = useState('');
  const [plateforme, setPlateforme] = useState('autre');
  const [domaines, setDomaines] = useState([]);
  const [domaineId, setDomaineId] = useState('');
  const [types, setTypes] = useState([]);
  const [typeId, setTypeId] = useState('');
  const [dairas, setDairas] = useState([]);
  const [dairaId, setDairaId] = useState('');
  const [communes, setCommunes] = useState([]);
  const [communeId, setCommuneId] = useState('');
  const [epics, setEpics] = useState([]);
  const [epicId, setEpicId] = useState('');
  const [gps, setGps] = useState('');
  const [gpsLat, setGpsLat] = useState(null);
  const [gpsLng, setGpsLng] = useState(null);
  const [statut, setStatut] = useState('non_traite');
  const [priorite, setPriorite] = useState('normale');
  const [dateSignalement, setDateSignalement] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState(null);

  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    apiFetch('/references/domaines').then((d) => setDomaines(d.data)).catch(() => {});
    apiFetch('/references/dairas').then((d) => setDairas(d.data)).catch(() => {});
    apiFetch('/references/epics').then((d) => setEpics(d.data)).catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch('/references/types?domaineId=' + (domaineId || '')).then((d) => { setTypes(d.data); setTypeId(''); }).catch(() => {});
  }, [domaineId]);

  useEffect(() => {
    apiFetch('/references/communes?dairaId=' + (dairaId || '')).then((d) => { setCommunes(d.data); setCommuneId(''); }).catch(() => {});
  }, [dairaId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView([36.7538, 3.0588], 13);
    mapRef.current = map;
    const isDark = document.documentElement.classList.contains('dark');
    L.tileLayer(isDark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© CARTO' }).addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && gpsLat !== null && gpsLng !== null) {
      map.setView([gpsLat, gpsLng], 15);
      if (map._marker) map.removeLayer(map._marker);
      const m = L.marker([gpsLat, gpsLng]).addTo(map);
      map._marker = m;
    }
  }, [gpsLat, gpsLng]);

  async function checkDuplicate() {
    if (!lien) return;
    try {
      const res = await apiFetch('/anomalies/check-duplicate?lien=' + encodeURIComponent(lien));
      setDuplicate(res.duplicate ? res.anomaly : null);
    } catch { setDuplicate(null); }
  }

  function handleGpsInput(value) {
    setGps(value);
    const parsed = parseGps(value);
    if (parsed) { setGpsLat(parsed.lat); setGpsLng(parsed.lng); }
  }

  function useMyPosition() {
    if (!navigator.geolocation) { setError('Géolocalisation non supportée'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude); setGps(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); },
      (err) => setError('Position indisponible : ' + err.message),
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch('/anomalies', {
        method: 'POST',
        body: {
          plateforme,
          lienUrl: lien,
          dateSignalement,
          domaineId: Number(domaineId),
          typeId: Number(typeId),
          dairaId: Number(dairaId),
          communeId: Number(communeId),
          gpsLat: gpsLat ?? (gps ? Number(gps.split(',')[0]) : undefined),
          gpsLng: gpsLng ?? (gps ? Number(gps.split(',')[1]) : undefined),
          statut,
          epicId: epicId ? Number(epicId) : undefined,
          priorite,
        },
      });
      onCreated(res.anomaly);
      setLien(''); setGps(''); setGpsLat(null); setGpsLng(null); setDuplicate(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]';

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-4 max-w-5xl">
      <h2 className="text-xl font-bold text-[var(--ink)]">{t('nouvelleAnomalie')}</h2>
      {error && <div className="p-3 bg-[var(--st-non-bg)] text-[var(--st-non)] rounded-[var(--r-md)] text-sm">{error}</div>}
      {duplicate && (
        <div className="p-3 bg-[var(--st-cours-bg)] text-[var(--st-cours)] rounded-[var(--r-md)] text-sm">
          Doublon détecté : {duplicate.reference} — {duplicate.lien_url}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-8">
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('lien')}</label>
          <input value={lien} onChange={(e) => { setLien(e.target.value); setPlateforme(detectPlatform(e.target.value)); }} onBlur={checkDuplicate} placeholder="https://www.facebook.com/watch?v=..." required className={inputCls} />
          <div className="text-xs text-[var(--muted)] mt-1">Plateforme détectée : {plateforme}</div>
        </div>
        <div className="md:col-span-4">
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">Date de signalement</label>
          <input type="date" value={dateSignalement} onChange={(e) => setDateSignalement(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('domaine')}</label>
          <select value={domaineId} onChange={(e) => setDomaineId(e.target.value)} required className={inputCls}>
            <option value="">{t('domaine')}</option>
            {domaines.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('type')}</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!domaineId} required className={inputCls}>
            <option value="">{t('type')}</option>
            {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('daire')}</label>
          <select value={dairaId} onChange={(e) => setDairaId(e.target.value)} required className={inputCls}>
            <option value="">{t('daire')}</option>
            {dairas.map((d) => <option key={d.id} value={d.id}>{d.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('commune')}</label>
          <select value={communeId} onChange={(e) => setCommuneId(e.target.value)} disabled={!dairaId} required className={inputCls}>
            <option value="">{t('commune')}</option>
            {communes.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('epic')}</label>
          <select value={epicId} onChange={(e) => setEpicId(e.target.value)} className={inputCls}>
            <option value="">{t('nonAffecte')}</option>
            {epics.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('priorite')}</label>
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)} className={inputCls}>
            <option value="normale">{t('normale')}</option>
            <option value="haute">{t('haute')}</option>
            <option value="urgente">{t('urgente')}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('gps')} (ou lien Google Maps / OSM)</label>
        <div className="flex gap-2">
          <input value={gps} onChange={(e) => handleGpsInput(e.target.value)} placeholder="36.7538, 3.0588 ou https://maps.google.com/?q=36.75,3.05" className={inputCls} />
          <button type="button" onClick={useMyPosition} className="h-11 px-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-sm whitespace-nowrap">Ma position</button>
        </div>
        {gpsLat !== null && <div className="text-xs text-[var(--muted)] mt-1">Lat {gpsLat.toFixed(6)}, Lng {gpsLng.toFixed(6)}</div>}
        <div ref={containerRef} className="mt-2 w-full h-40 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)]" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">{t('statut') || 'Statut'}</label>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className={inputCls}>
          <option value="non_traite">{t('statut_non_traite')}</option>
          <option value="en_cours">{t('statut_en_cours')}</option>
          <option value="traite">{t('statut_traite')}</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="bg-[var(--brand-600)] text-white px-4 py-2 rounded-[var(--r-md)] disabled:opacity-50">
          {busy ? '...' : t('enregistrer')}
        </button>
        <button type="button" disabled={busy} onClick={async (e) => { e.preventDefault(); await handleSubmit(e); }} className="bg-[var(--surface-2)] px-4 py-2 rounded-[var(--r-md)] disabled:opacity-50 border border-[var(--border)]">
          {t('enregistrerEtNouveau')}
        </button>
      </div>
    </form>
  );
}