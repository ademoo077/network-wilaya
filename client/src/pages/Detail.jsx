import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';

export default function Detail({ id, onBack }) {
  const { t } = useI18n();
  const [anomaly, setAnomaly] = useState(null);
  const [hist, setHist] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    apiFetch('/anomalies/' + id).then(setAnomaly).catch((e) => setError(e.message));
    apiFetch('/anomalies/' + id + '/historique').then((d) => setHist(d.data || [])).catch(() => {});
  }, [id]);

  if (error) return <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 text-[var(--st-non)]">{error}</div>;
  if (!anomaly) return <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">{t('loading')}</div>;

  const a = anomaly.anomaly || anomaly;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm underline text-[var(--brand-600)]">{t('retour')}</button>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h2 className="text-xl font-bold mb-2">{a.reference}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-[var(--muted)]">Statut:</span> {a.statut}</div>
          <div><span className="text-[var(--muted)]">Priorité:</span> {a.priorite}</div>
          <div><span className="text-[var(--muted)]">Domaine:</span> {a.domaine_id}</div>
          <div><span className="text-[var(--muted)]">Type:</span> {a.type_id}</div>
          <div><span className="text-[var(--muted)]">Daïra:</span> {a.daira_id}</div>
          <div><span className="text-[var(--muted)]">Commune:</span> {a.commune_id}</div>
          <div><span className="text-[var(--muted)]">EPIC:</span> {a.epic_id ?? t('nonAffecte')}</div>
          <div><span className="text-[var(--muted)]">Plateforme:</span> {a.plateforme}</div>
          <div className="md:col-span-2"><span className="text-[var(--muted)]">Lien:</span> <a href={a.lien_url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-600)] underline">{a.lien_url}</a></div>
          {a.observations && <div className="md:col-span-2"><span className="text-[var(--muted)]">Observations:</span> {a.observations}</div>}
        </div>
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h3 className="text-lg font-bold mb-2">Historique</h3>
        <ul className="space-y-1 text-sm">
          {hist.map((h) => (
            <li key={h.id} className="border-b border-[var(--border)] py-1">
              {h.at} — {h.champ}: {h.ancienne_valeur} → {h.nouvelle_valeur}
            </li>
          ))}
          {hist.length === 0 && <li className="text-[var(--muted)]">Aucun historique</li>}
        </ul>
      </div>
    </div>
  );
}
