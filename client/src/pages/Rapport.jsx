import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';

export default function Rapport() {
  const { t } = useI18n();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch('/reports/weekly?week_start=' + new Date().toISOString().slice(0, 10))
      .then((d) => setReport(d.report))
      .catch((e) => setError(e.message));
  }, []);

  async function handleExportXlsx() {
    const res = await fetch('/api/reports/weekly/export?format=xlsx&week_start=' + new Date().toISOString().slice(0, 10), { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Export impossible');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rapport.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFreeze() {
    setBusy(true);
    try {
      await apiFetch('/reports/weekly/snapshot', { method: 'POST', body: { week_start: new Date().toISOString().slice(0, 10) } });
    } finally {
      setBusy(false);
    }
  }

  function handleCopySummary() {
    if (!report) return;
    const kpis = report.kpis || {};
    const text = [
      'WILAYA D\'ALGER - CELLULE TECHNIQUE DE NUMERISATION',
      'Synthèse hebdomadaire des anomalies',
      `Periode: ${report.semaine_debut} -> ${report.semaine_fin}`,
      `Total receptions: ${kpis.total}`,
      `Non traitee: ${kpis.parStatut?.non_traite}`,
      `En cours: ${kpis.parStatut?.en_cours}`,
      `Traitee: ${kpis.parStatut?.traite}`,
      `Taux de traitement: ${kpis.tauxTraitement}`,
    ].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (error) {
    return <div className="bg-white rounded-lg shadow p-6 text-red-700">{error}</div>;
  }
  if (!report) {
    return <div className="bg-white rounded-lg shadow p-6">{t('loading')}</div>;
  }

  const kpis = report.kpis || {};

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Synthèse hebdomadaire</h2>
            <p className="text-gray-500">
              {report.semaine_debut} → {report.semaine_fin}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-gray-200 px-3 py-2 rounded text-sm">Imprimer / PDF</button>
            <button onClick={handleExportXlsx} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Exporter Excel</button>
            <button onClick={handleFreeze} disabled={busy} className="bg-green-600 text-white px-3 py-2 rounded text-sm">Figer</button>
            <button onClick={handleCopySummary} className="bg-gray-200 px-3 py-2 rounded text-sm">Copier le resume</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Total receptions</div><div className="text-xl font-bold">{kpis.total}</div></div>
          <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Taux de traitement</div><div className="text-xl font-bold">{kpis.tauxTraitement === null ? '—' : kpis.tauxTraitement + ' %'}</div></div>
          <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">En retard</div><div className="text-xl font-bold">{kpis.enRetard}</div></div>
          <div className="p-3 bg-gray-50 rounded"><div className="text-xs text-gray-500">Urgentes</div><div className="text-xl font-bold">{kpis.urgents}</div></div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-3">Par categorie</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Domaine</th>
              <th className="p-2">Non traitee</th>
              <th className="p-2">En cours</th>
              <th className="p-2">Traitee</th>
            </tr>
          </thead>
          <tbody>
            {(report.byCategory || []).map((row) => (
              <tr key={row.domaine_id} className="border-t">
                <td className="p-2">{row.domaine_name}</td>
                <td className="p-2">{row.counts.non_traite}</td>
                <td className="p-2">{row.counts.en_cours}</td>
                <td className="p-2">{row.counts.traite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-3">Urgentes</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Reference</th>
              <th className="p-2">Lien</th>
              <th className="p-2">Priorite</th>
              <th className="p-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(report.urgentes || []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.reference}</td>
                <td className="p-2">{row.lien_url}</td>
                <td className="p-2">{row.priorite}</td>
                <td className="p-2">{row.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
