import { useEffect, useState } from 'react';
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
  const [statut, setStatut] = useState('non_traite');
  const [priorite, setPriorite] = useState('normale');
  const [observations, setObservations] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
          domaineId: Number(domaineId),
          typeId: Number(typeId),
          dairaId: Number(dairaId),
          communeId: Number(communeId),
          gpsLat: gps ? Number(gps.split(',')[0]) : undefined,
          gpsLng: gps ? Number(gps.split(',')[1]) : undefined,
          statut,
          epicId: epicId ? Number(epicId) : undefined,
          priorite,
          observations: observations || undefined,
        },
      });
      onCreated(res.anomaly);
      setLien('');
      setObservations('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-4 max-w-3xl">
      <h2 className="text-xl font-bold">{t('nouvelleAnomalie')}</h2>
      {error && <div className="p-3 bg-[var(--st-non-bg)] text-[var(--st-non)] rounded-[var(--r-md)] text-sm">{error}</div>}
      <div>
        <label className="block text-sm font-medium mb-1">{t('lien')}</label>
        <input value={lien} onChange={(e) => { setLien(e.target.value); setPlateforme(detectPlatform(e.target.value)); }} placeholder="https://facebook.com/watch?v=..." required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t('domaine')}</label>
          <select value={domaineId} onChange={(e) => setDomaineId(e.target.value)} required>
            <option value="">{t('domaine')}</option>
            {domaines.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('type')}</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!domaineId} required>
            <option value="">{t('type')}</option>
            {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.name_ar}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('daire')}</label>
          <select value={dairaId} onChange={(e) => setDairaId(e.target.value)} required>
            <option value="">{t('daire')}</option>
            {dairas.map((d) => <option key={d.id} value={d.id}>{d.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('commune')}</label>
          <select value={communeId} onChange={(e) => setCommuneId(e.target.value)} disabled={!dairaId} required>
            <option value="">{t('commune')}</option>
            {communes.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('epic')}</label>
          <select value={epicId} onChange={(e) => setEpicId(e.target.value)}>
            <option value="">{t('nonAffecte')}</option>
            {epics.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('gps')}</label>
          <input value={gps} onChange={(e) => setGps(e.target.value)} placeholder="36.7538, 3.0588" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{t('statut') || 'Statut'}</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="non_traite">{t('statut_non_traite')}</option>
            <option value="en_cours">{t('statut_en_cours')}</option>
            <option value="traite">{t('statut_traite')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('priorite')}</label>
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)}>
            <option value="normale">{t('normale')}</option>
            <option value="haute">{t('haute')}</option>
            <option value="urgente">{t('urgente')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('observations')}</label>
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={4} className="w-full" />
        </div>
      </div>
      <button type="submit" disabled={busy} className="bg-[var(--brand-600)] text-white px-4 py-2 rounded-[var(--r-md)] disabled:opacity-50">
        {busy ? '...' : t('enregistrer')}
      </button>
      <button type="button" disabled={busy} onClick={async (e) => { e.preventDefault(); await handleSubmit(e); }} className="bg-[var(--surface-2)] px-4 py-2 rounded-[var(--r-md)] disabled:opacity-50">
        {t('enregistrerEtNouveau')}
      </button>
    </form>
  );
}
