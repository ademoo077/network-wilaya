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

  if (error) return <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-red-700">{error}</div>;
  if (!anomaly) return <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">{t('loading')}</div>;

  const a = anomaly.anomaly || anomaly;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm underline text-blue-600">{t('retour')}</button>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-2">{a.reference}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Statut:</span> {a.statut}</div>
          <div><span className="text-gray-500">Priorité:</span> {a.priorite}</div>
          <div><span className="text-gray-500">Domaine:</span> {a.domaine_id}</div>
          <div><span className="text-gray-500">Type:</span> {a.type_id}</div>
          <div><span className="text-gray-500">Daïra:</span> {a.daira_id}</div>
          <div><span className="text-gray-500">Commune:</span> {a.commune_id}</div>
          <div><span className="text-gray-500">EPIC:</span> {a.epic_id ?? t('nonAffecte')}</div>
          <div><span className="text-gray-500">Plateforme:</span> {a.plateforme}</div>
          <div className="md:col-span-2"><span className="text-gray-500">Lien:</span> <a href={a.lien_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{a.lien_url}</a></div>
          {a.observations && <div className="md:col-span-2"><span className="text-gray-500">Observations:</span> {a.observations}</div>}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-2">Historique</h3>
        <ul className="space-y-1 text-sm">
          {hist.map((h) => (
            <li key={h.id} className="border-b border-gray-200 dark:border-gray-700 py-1">
              {h.at} — {h.champ}: {h.ancienne_valeur} → {h.nouvelle_valeur}
            </li>
          ))}
          {hist.length === 0 && <li className="text-gray-500">Aucun historique</li>}
        </ul>
      </div>
    </div>
  );
}
