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
    try { await apiFetch('/reports/weekly/snapshot', { method: 'POST', body: { week_start: new Date().toISOString().slice(0, 10) } }); } finally { setBusy(false); }
  }

  function handleCopySummary() {
    if (!report) return;
    const kpis = report.kpis || {};
    const text = ['WILAYA D\'ALGER - CELLULE TECHNIQUE DE NUMERISATION','Synthèse hebdomadaire des anomalies',
      `Période: ${report.semaine_debut} → ${report.semaine_fin}`,
      `Total réceptions: ${kpis.total}`,
      `Non traitée: ${kpis.parStatut?.non_traite}`,
      `En cours: ${kpis.parStatut?.en_cours}`,
      `Traitée: ${kpis.parStatut?.traite}`,
      `Taux de traitement: ${kpis.tauxTraitement}`].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  if (error) return <div className="bg-[var(--st-non-bg)] text-[var(--st-non)] rounded-[var(--r-md)] p-6">{error}</div>;
  if (!report) return <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">{t('loading')}</div>;

  const kpis = report.kpis || {};

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--ink)]">Synthèse hebdomadaire</h2>
            <p className="text-[var(--muted)] text-sm">{report.semaine_debut} → {report.semaine_fin}</p>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => window.print()} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] px-3 py-2 rounded-[var(--r-md)] text-sm">Imprimer / PDF</button>
            <button onClick={handleExportXlsx} className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Exporter Excel</button>
            <button onClick={handleFreeze} disabled={busy} className="bg-[var(--st-traite)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm disabled:opacity-50">Figer</button>
            <button onClick={handleCopySummary} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] px-3 py-2 rounded-[var(--r-md)] text-sm">Copier le résumé</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-[var(--surface-2)] rounded-[var(--r-md)]"><div className="text-xs text-[var(--muted)]">Total réceptions</div><div className="text-xl font-bold text-[var(--ink)]">{kpis.total}</div></div>
          <div className="p-3 bg-[var(--surface-2)] rounded-[var(--r-md)]"><div className="text-xs text-[var(--muted)]">Taux de traitement</div><div className="text-xl font-bold text-[var(--ink)]">{kpis.tauxTraitement === null ? '—' : kpis.tauxTraitement + ' %'}</div></div>
          <div className="p-3 bg-[var(--surface-2)] rounded-[var(--r-md)]"><div className="text-xs text-[var(--muted)]">En retard</div><div className="text-xl font-bold text-[var(--ink)]">{kpis.enRetard}</div></div>
          <div className="p-3 bg-[var(--surface-2)] rounded-[var(--r-md)]"><div className="text-xs text-[var(--muted)]">Urgentes</div><div className="text-xl font-bold text-[var(--ink)]">{kpis.urgents}</div></div>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h3 className="text-lg font-bold mb-3 text-[var(--ink)]">Par catégorie</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]">
              <tr>
                <th className="p-2 text-start">Domaine</th>
                <th className="p-2 text-start">Non traitée</th>
                <th className="p-2 text-start">En cours</th>
                <th className="p-2 text-start">Traité</th>
              </tr>
            </thead>
            <tbody>
              {(report.byCategory || []).map((row) => (
                <tr key={row.domaine_id} className="border-t border-[var(--border)]">
                  <td className="p-2">{row.domaine_name}</td>
                  <td className="p-2 text-[var(--st-non)]">{row.counts.non_traite}</td>
                  <td className="p-2 text-[var(--st-cours)]">{row.counts.en_cours}</td>
                  <td className="p-2 text-[var(--st-traite)]">{row.counts.traite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h3 className="text-lg font-bold mb-3 text-[var(--ink)]">Urgentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]">
              <tr>
                <th className="p-2 text-start">Référence</th>
                <th className="p-2 text-start">Lien</th>
                <th className="p-2 text-start">Priorité</th>
                <th className="p-2 text-start">Statut</th>
              </tr>
            </thead>
            <tbody>
              {(report.urgentes || []).map((row) => (
                <tr key={row.id} className="border-t border-[var(--border)]">
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
    </div>
  );
}