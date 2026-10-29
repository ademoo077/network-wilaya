import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';
import { KpiCard, Card, CardHeader, CardBody, EmptyState, Skeleton, Button } from '../components/ui';

const STATUS_COLORS = { non_traite: '#dc2626', en_cours: '#d97706', traite: '#059669' };

function periodRange(period) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  let from;
  if (period === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7); from = d.toISOString().slice(0, 10);
  } else if (period === 'month') {
    const d = new Date(now); d.setMonth(d.getMonth() - 1); from = d.toISOString().slice(0, 10);
  } else {
    const d = new Date(now); d.setDate(d.getDate() - 30); from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

export default function Dashboard({ onDrillDown }) {
  const { t } = useI18n();
  const [period, setPeriod] = useState('month');
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [byType, setByType] = useState([]);
  const [byDaira, setByDaira] = useState([]);
  const [byEpic, setByEpic] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = useMemo(() => periodRange(period), [period]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = `from=${range.from}&to=${range.to}`;
    Promise.all([
      apiFetch('/stats/summary?' + q).then(setSummary),
      apiFetch('/stats/by-category?' + q).then((d) => setByCategory(d.data || [])),
      apiFetch('/stats/by-type?' + q).then((d) => setByType(d.data || [])),
      apiFetch('/stats/by-daira?' + q).then((d) => setByDaira(d.data || [])),
      apiFetch('/stats/by-epic?' + q).then((d) => setByEpic(d.data || [])),
      apiFetch('/stats/weekly?weeks=12').then((d) => setWeekly(d.data || [])),
    ]).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [range]);

  const statutData = summary ? [
    { name: t('statut_non_traite'), value: summary.parStatut.non_traite, color: STATUS_COLORS.non_traite },
    { name: t('statut_en_cours'), value: summary.parStatut.en_cours, color: STATUS_COLORS.en_cours },
    { name: t('statut_traite'), value: summary.parStatut.traite, color: STATUS_COLORS.traite },
  ] : [];

  const topCategories = [...byCategory].sort((a, b) => {
    const ta = a.counts.non_traite + a.counts.en_cours + a.counts.traite;
    const tb = b.counts.non_traite + b.counts.en_cours + b.counts.traite;
    return tb - ta;
  }).slice(0, 12);

  const categoryData = topCategories.map((c) => ({
    name: c.domaine_name,
    domaine_id: c.domaine_id,
    total: c.counts.non_traite + c.counts.en_cours + c.counts.traite,
  }));

  const weeklyData = weekly.map((w) => ({
    week: (w.weekStart || '').slice(5),
    received: w.received,
    treated: w.treated,
  }));

  const topTypes = [...byType].sort((a, b) => {
    const ta = a.counts.non_traite + a.counts.en_cours + a.counts.traite;
    const tb = b.counts.non_traite + b.counts.en_cours + b.counts.traite;
    return tb - ta;
  }).slice(0, 10).map((c) => ({
    name: c.type_name,
    total: c.counts.non_traite + c.counts.en_cours + c.counts.traite,
  }));

  const dairaData = [...byDaira].sort((a, b) => {
    const ta = a.counts.non_traite + a.counts.en_cours + a.counts.traite;
    const tb = b.counts.non_traite + b.counts.en_cours + b.counts.traite;
    return tb - ta;
  }).slice(0, 10).map((c) => ({
    name: c.daire_name,
    total: c.counts.non_traite + c.counts.en_cours + c.counts.traite,
  }));

  if (loading && !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return <div className="bg-[var(--st-non-bg)] text-[var(--st-non)] rounded-[var(--r-md)] p-4">{error}</div>;
  }

  const s = summary || { total: 0, parStatut: { non_traite: 0, en_cours: 0, traite: 0 }, tauxTraitement: null, delaiMoyenJours: null, urgents: 0, enRetard: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Tableau de bord</h1>
          <p className="text-sm text-[var(--muted)]">Période : {range.from} → {range.to}</p>
        </div>
        <div className="flex items-center gap-2">
          {['week', 'month', '30d'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-[var(--r-md)] text-sm border ${period === p ? 'bg-[var(--brand-600)] text-white border-[var(--brand-600)]' : 'border-[var(--border)] text-[var(--ink-2)] hover:bg-[var(--brand-50)]'}`}>
              {p === 'week' ? '7 jours' : p === 'month' ? '30 jours' : '90 jours'}
            </button>
          ))}
          <Button onClick={() => onDrillDown?.({})}>Nouvelle anomalie</Button>
        </div>
      </div>

      {s.urgents > 0 && (
        <button onClick={() => onDrillDown?.({ priorite: 'urgente', statut: 'non_traite' })} className="w-full text-left p-3 rounded-[var(--r-md)] bg-[var(--st-non-bg)] text-[var(--st-non)] text-sm">
          {s.urgents} anomalie(s) urgente(s) ouverte(s) — cliquer pour filtrer
        </button>
      )}
      {s.enRetard > 0 && (
        <button onClick={() => onDrillDown?.({})} className="w-full text-left p-3 rounded-[var(--r-md)] bg-[var(--st-cours-bg)] text-[var(--st-cours)] text-sm">
          {s.enRetard} anomalie(s) en retard (&gt; 7 jours)
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Total" value={s.total} />
        <KpiCard label="Non traitées" value={s.parStatut.non_traite} />
        <KpiCard label="En cours" value={s.parStatut.en_cours} />
        <KpiCard label="Traitées" value={s.parStatut.traite} />
        <KpiCard label="Taux de traitement" value={s.tauxTraitement === null ? '—' : s.tauxTraitement + ' %'} />
        <KpiCard label="Délai moyen (j)" value={s.delaiMoyenJours === null ? '—' : Number(s.delaiMoyenJours).toFixed(1)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Répartition par statut" />
          <CardBody>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statutData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2}>
                    {statutData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {statutData.every((d) => d.value === 0) && <EmptyState title="Aucune donnée sur la période" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Évolution hebdomadaire (12 semaines)" />
          <CardBody>
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="received" name="Reçues" fill="#3b82f6" />
                  <Bar dataKey="treated" name="Traitées" fill="#059669" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {weeklyData.every((w) => w.received === 0 && w.treated === 0) && <EmptyState title="Aucune donnée sur la période" />}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Par catégorie" />
          <CardBody>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="#0e8a5a" onClick={(p) => { const e = p?.original; if (e?.domaine_id) onDrillDown?.({ domaineId: e.domaine_id }); }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {categoryData.length === 0 && <EmptyState title="Aucune donnée" />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Par type" />
          <CardBody>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTypes} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Bar dataKey="total" name="Total" fill="#12a66d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {topTypes.length === 0 && <EmptyState title="Aucune donnée" />}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Par daïra" />
        <CardBody>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dairaData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#c9a227" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {dairaData.length === 0 && <EmptyState title="Aucune donnée" />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Par EPIC" />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  <th className="text-start p-2">EPIC</th>
                  <th className="text-start p-2">Non traité</th>
                  <th className="text-start p-2">En cours</th>
                  <th className="text-start p-2">Traité</th>
                  <th className="text-start p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {byEpic.map((e) => {
                  const total = e.counts.non_traite + e.counts.en_cours + e.counts.traite;
                  return (
                    <tr key={e.epic_id} className="border-t border-[var(--border)]">
                      <td className="p-2">{e.epic_name}</td>
                      <td className="p-2 text-[var(--st-non)]">{e.counts.non_traite}</td>
                      <td className="p-2 text-[var(--st-cours)]">{e.counts.en_cours}</td>
                      <td className="p-2 text-[var(--st-traite)]">{e.counts.traite}</td>
                      <td className="p-2 font-semibold">{total}</td>
                    </tr>
                  );
                })}
                {byEpic.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-[var(--muted)]">Aucune donnée</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}