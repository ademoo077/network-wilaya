import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const STATUS_COLORS = { non_traite: '#dc2626', en_cours: '#d97706', traite: '#059669' };

function shiftDays(iso, n) {
  const d = new Date(iso + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function Rapport() {
  const { t } = useI18n();
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [prevReport, setPrevReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setError(null);
    apiFetch('/reports/weekly?week_start=' + refDate).then(setReport).catch((e) => setError(e.message));
    const prev = shiftDays(refDate, -7);
    apiFetch('/reports/weekly?week_start=' + prev).then(setPrevReport).catch(() => {});
  }, [refDate]);

  async function handleExportXlsx() {
    const res = await fetch('/api/reports/weekly/export?format=xlsx&week_start=' + refDate, { credentials: 'same-origin' });
    if (!res.ok) { setMsg('Export impossible'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rapport.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }
  async function handleFreeze() {
    setBusy(true); setMsg(null);
    try { await apiFetch('/reports/weekly/snapshot', { method: 'POST', body: { week_start: refDate } }); setMsg('Synthèse figée.'); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  function handleCopySummary() {
    if (!report) return;
    const k = report.kpis || {};
    const text = ['WILAYA D\'ALGER — CELLULE TECHNIQUE DE NUMÉRISATION', 'Synthèse hebdomadaire des anomalies',
      `Période : ${report.semaine_debut} → ${report.semaine_fin}`,
      `Réceptions : ${k.total}`, `Non traitées : ${k.parStatut?.non_traite}`, `En cours : ${k.parStatut?.en_cours}`,
      `Traitées : ${k.parStatut?.traite}`, `Taux de traitement : ${k.tauxTraitement}`, `Délai moyen : ${k.delaiMoyenJours}`].join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    setMsg('Résumé copié.');
  }

  if (error) return <div className="bg-[var(--st-non-bg)] text-[var(--st-non)] rounded-[var(--r-md)] p-6">{error}</div>;
  if (!report) return <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">{t('loading')}</div>;

  const k = report.kpis || { total: 0, parStatut: { non_traite: 0, en_cours: 0, traite: 0 }, tauxTraitement: null, delaiMoyenJours: null, urgents: 0, enRetard: 0 };
  const pk = prevReport?.kpis || { total: 0, parStatut: { non_traite: 0, en_cours: 0, traite: 0 }, tauxTraitement: null };
  const delta = (a, b) => (a == null || b == null) ? null : a - b;
  const statutData = [
    { name: 'Non traité', value: k.parStatut.non_traite, color: STATUS_COLORS.non_traite },
    { name: 'En cours', value: k.parStatut.en_cours, color: STATUS_COLORS.en_cours },
    { name: 'Traité', value: k.parStatut.traite, color: STATUS_COLORS.traite },
  ];
  const topCat = [...(report.byCategory || [])].sort((a, b) => (b.counts.non_traite + b.counts.en_cours + b.counts.traite) - (a.counts.non_traite + a.counts.en_cours + a.counts.traite)).slice(0, 10).map((c) => ({ name: c.domaine_name, total: c.counts.non_traite + c.counts.en_cours + c.counts.traite }));

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--ink)]">Synthèse hebdomadaire</h2>
            <p className="text-[var(--muted)] text-sm">{report.semaine_debut} → {report.semaine_fin}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setRefDate(shiftDays(refDate, -7))} className="px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-sm text-[var(--ink-2)] hover:bg-[var(--brand-50)]">◀ Préc.</button>
            <button onClick={() => setRefDate(new Date().toISOString().slice(0, 10))} className="px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-sm text-[var(--ink-2)] hover:bg-[var(--brand-50)]">Cette semaine</button>
            <button onClick={() => setRefDate(shiftDays(refDate, 7))} className="px-3 py-1.5 rounded-[var(--r-md)] border border-[var(--border)] text-sm text-[var(--ink-2)] hover:bg-[var(--brand-50)]">Suiv. ▶</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] px-3 py-2 rounded-[var(--r-md)] text-sm">Imprimer / PDF</button>
            <button onClick={handleExportXlsx} className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Exporter Excel</button>
            <button onClick={handleFreeze} disabled={busy} className="bg-[var(--st-traite)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm disabled:opacity-50">Figer</button>
            <button onClick={handleCopySummary} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] px-3 py-2 rounded-[var(--r-md)] text-sm">Copier le résumé</button>
          </div>
        </div>
        {msg && <div className="mt-3 p-2 bg-[var(--surface-2)] rounded text-sm text-[var(--ink-2)]">{msg}</div>}
      </div>

      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6" id="report-paper">
        <div className="text-center mb-4">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">Wilaya d'Alger — Cellule technique de numérisation</div>
          <h3 className="text-lg font-bold text-[var(--ink)]">Synthèse hebdomadaire des anomalies</h3>
          <div className="text-sm text-[var(--muted)]">Période : {report.semaine_debut} → {report.semaine_fin} · Généré le {report.genere_le?.slice(0, 10)}</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiBlock label="Réceptions" value={k.total} delta={delta(k.total, pk.total)} />
          <KpiBlock label="Traitées" value={k.parStatut.traite} delta={delta(k.parStatut.traite, pk.parStatut.traite)} />
          <KpiBlock label="En cours" value={k.parStatut.en_cours} />
          <KpiBlock label="Non traitées" value={k.parStatut.non_traite} />
          <KpiBlock label="Taux de traitement" value={k.tauxTraitement === null ? '—' : k.tauxTraitement + ' %'} />
          <KpiBlock label="Délai moyen (j)" value={k.delaiMoyenJours === null ? '—' : Number(k.delaiMoyenJours).toFixed(1)} />
          <KpiBlock label="Stock ouvert" value={k.parStatut.non_traite + k.parStatut.en_cours} />
          <KpiBlock label="Urgentes" value={k.urgents} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="text-sm font-semibold mb-2 text-[var(--ink)]">Répartition par statut</h4>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {statutData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2 text-[var(--ink)]">Par catégorie</h4>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCat} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0e8a5a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <h4 className="text-sm font-semibold mb-2 text-[var(--ink)]">Par catégorie</h4>
        <SimpleTable headers={['Domaine', 'Non traitée', 'En cours', 'Traité', 'Total']} rows={(report.byCategory || []).map((r) => [r.domaine_name, r.counts.non_traite, r.counts.en_cours, r.counts.traite, r.counts.non_traite + r.counts.en_cours + r.counts.traite])} />

        <h4 className="text-sm font-semibold mb-2 mt-4 text-[var(--ink)]">Par type</h4>
        <SimpleTable headers={['Type', 'Domaine', 'Non traitée', 'En cours', 'Traité', 'Total']} rows={(report.byType || []).map((r) => [r.type_name, r.domaine_id, r.counts.non_traite, r.counts.en_cours, r.counts.traite, r.counts.non_traite + r.counts.en_cours + r.counts.traite])} />

        <h4 className="text-sm font-semibold mb-2 mt-4 text-[var(--ink)]">Par daïra</h4>
        <SimpleTable headers={['Daïra', 'Non traitée', 'En cours', 'Traité', 'Total']} rows={(report.byDaira || []).map((r) => [r.daire_name, r.counts.non_traite, r.counts.en_cours, r.counts.traite, r.counts.non_traite + r.counts.en_cours + r.counts.traite])} />

        <h4 className="text-sm font-semibold mb-2 mt-4 text-[var(--ink)]">Par commune</h4>
        <SimpleTable headers={['Commune', 'Non traitée', 'En cours', 'Traité', 'Total']} rows={(report.byCommune || []).map((r) => [r.commune_name, r.counts.non_traite, r.counts.en_cours, r.counts.traite, r.counts.non_traite + r.counts.en_cours + r.counts.traite])} />

        <h4 className="text-sm font-semibold mb-2 mt-4 text-[var(--ink)]">Par EPIC</h4>
        <SimpleTable headers={['EPIC', 'Non traitée', 'En cours', 'Traité', 'Total']} rows={(report.byEpic || []).map((r) => [r.epic_name, r.counts.non_traite, r.counts.en_cours, r.counts.traite, r.counts.non_traite + r.counts.en_cours + r.counts.traite])} />

        <h4 className="text-sm font-semibold mb-2 mt-4 text-[var(--ink)]">Urgentes et en retard</h4>
        <SimpleTable headers={['Référence', 'Lien', 'Priorité', 'Statut']} rows={(report.urgentes || []).map((r) => [r.reference, r.lien_url, r.priorite, r.statut])} />

        <div className="mt-8 grid grid-cols-2 gap-8 text-sm text-[var(--muted)]">
          <div className="border-t border-[var(--border)] pt-2">Visa cellule technique</div>
          <div className="border-t border-[var(--border)] pt-2">Visa hiérarchique</div>
        </div>
      </div>
    </div>
  );
}

function KpiBlock({ label, value, delta }) {
  return (
    <div className="p-3 bg-[var(--surface-2)] rounded-[var(--r-md)]">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="text-xl font-bold text-[var(--ink)] tabular-nums">{value}</div>
      {delta !== null && delta !== undefined && (
        <div className={`text-xs ${delta >= 0 ? 'text-[var(--st-traite)]' : 'text-[var(--st-non)]'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}</div>
      )}
    </div>
  );
}

function SimpleTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[var(--surface-2)]">
          <tr>{headers.map((h) => <th key={h} className="p-2 text-start font-medium text-[var(--ink-2)]">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              {row.map((cell, j) => <td key={j} className="p-2 text-[var(--ink-2)]">{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={headers.length} className="p-3 text-center text-[var(--muted)]">Aucune donnée</td></tr>}
        </tbody>
      </table>
    </div>
  );
}