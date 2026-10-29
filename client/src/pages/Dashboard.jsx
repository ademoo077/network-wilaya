import { useEffect, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';

const STATUS_COLORS = {
  non_traite: '#ef4444',
  en_cours: '#f97316',
  traite: '#22c55e',
};

export default function Dashboard({ onDrillDown }) {
  const { t } = useI18n();
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    apiFetch('/stats/summary').then(setSummary).catch(() => {});
    apiFetch('/api/stats/by-category').then((d) => setByCategory(d.data)).catch(() => {});
    apiFetch('/api/stats/weekly?weeks=12').then((d) => setWeekly(d.data)).catch(() => {});
  }, []);

  if (!summary) {
    return <div className="bg-white rounded-lg shadow p-6">{t('loading')}</div>;
  }

  const statutData = [
    { name: t('statut_non_traite'), value: summary.parStatut.non_traite, color: STATUS_COLORS.non_traite },
    { name: t('statut_en_cours'), value: summary.parStatut.en_cours, color: STATUS_COLORS.en_cours },
    { name: t('statut_traite'), value: summary.parStatut.traite, color: STATUS_COLORS.traite },
  ];

  const topCategories = [...byCategory].sort((a, b) => {
    const totalA = a.counts.non_traite + a.counts.en_cours + a.counts.traite;
    const totalB = b.counts.non_traite + b.counts.en_cours + b.counts.traite;
    return totalB - totalA;
  }).slice(0, 10);

  const categoryData = topCategories.map((c) => ({
    name: c.domaine_name,
    domaine_id: c.domaine_id,
    total: c.counts.non_traite + c.counts.en_cours + c.counts.traite,
    non_traite: c.counts.non_traite,
    en_cours: c.counts.en_cours,
    traite: c.counts.traite,
  }));

  const weeklyData = weekly.map((w) => ({
    week: (w.weekStart || '').slice(5),
    received: w.received,
    treated: w.treated,
  }));

  const kpis = [
    { label: t('total'), value: summary.total },
    { label: t('tauxTraitement') || 'Taux de traitement', value: summary.tauxTraitement === null ? '—' : summary.tauxTraitement + ' %' },
    { label: t('enRetard') || 'En retard', value: summary.enRetard },
    { label: t('urgentes') || 'Urgentes', value: summary.urgents },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">{k.label}</div>
            <div className="text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">{t('repartitionStatuts') || 'Répartition par statut'}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={statutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
              {statutData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        {statutData.every((d) => d.value === 0) && (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">Aucune donnée sur la période</div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">{t('evolutionHebdomadaire') || 'Évolution hebdomadaire (12 semaines)'}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weeklyData}>
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="received" name={t('recues') || 'Reçues'} fill="#3b82f6" />
            <Bar dataKey="treated" name={t('traitees') || 'Traitées'} fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
        {weeklyData.every((w) => w.received === 0 && w.treated === 0) && (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">Aucune donnée sur la période</div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">{t('parCategorie') || 'Par catégorie'}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={140} />
            <Tooltip />
            <Bar dataKey="total" name={t('total')} fill="#3b82f6" onClick={(payload) => { const entry = payload?.original; if (entry?.domaine_id) onDrillDown?.({ domaineId: entry.domaine_id }); }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
