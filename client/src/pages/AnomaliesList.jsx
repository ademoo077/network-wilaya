import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';

const STATUS_KEYS = {
  non_traite: 'statut_non_traite',
  en_cours: 'statut_en_cours',
  traite: 'statut_traite',
};

const STATUS_DOT = {
  non_traite: 'bg-red-500',
  en_cours: 'bg-orange-500',
  traite: 'bg-green-600',
};

export default function AnomaliesList({ onOpen }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ page: 1, pageSize: 25 });
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const data = await apiFetch('/anomalies?' + params.toString());
    setItems(data.data);
    setPagination(data.pagination);
  }, [filters]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function changeStatus(id, statut) {
    await apiFetch(`/anomalies/${id}`, { method: 'PATCH', body: { statut } });
    await load();
  }

  async function bulkChangeStatus(statut) {
    if (selected.length === 0) return;
    await apiFetch('/anomalies/bulk-status', { method: 'POST', body: { ids: selected, statut } });
    setSelected([]);
    await load();
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <select value={filters.statut || ''} onChange={(e) => setFilters({ ...filters, statut: e.target.value, page: 1 })}>
          <option value="">{t('all')}</option>
          <option value="non_traite">{t('statut_non_traite')}</option>
          <option value="en_cours">{t('statut_en_cours')}</option>
          <option value="traite">{t('statut_traite')}</option>
        </select>
        <select value={filters.domaineId || ''} onChange={(e) => setFilters({ ...filters, domaineId: e.target.value ? Number(e.target.value) : undefined, page: 1 })}>
          <option value="">{t('domaine')}</option>
        </select>
        <select value={filters.dairaId || ''} onChange={(e) => setFilters({ ...filters, dairaId: e.target.value ? Number(e.target.value) : undefined, page: 1 })}>
          <option value="">{t('daire')}</option>
        </select>
        <select value={filters.epicId || ''} onChange={(e) => setFilters({ ...filters, epicId: e.target.value ? Number(e.target.value) : undefined, page: 1 })}>
          <option value="">{t('epic')}</option>
        </select>
        <input placeholder={t('searchPlaceholder')} value={filters.q || ''} onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })} />
        <button onClick={() => load()}>{t('actions')}</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">
                <input type="checkbox" onChange={(e) => { if (e.target.checked) setSelected(items.map((i) => i.id)); else setSelected([]); }} />
              </th>
              <th>{t('date')}</th>
              <th>{t('statut') || 'Statut'}</th>
              <th>{t('domaine')}</th>
              <th>{t('type')}</th>
              <th>{t('epic')}</th>
              <th>{t('lien')}</th>
              <th>{t('gps')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(row.id)}>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} />
                </td>
                <td className="p-2">{row.date_signalement}</td>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <select value={row.statut} onChange={(e) => changeStatus(row.id, e.target.value)}>
                    <option value="non_traite">{t('statut_non_traite')}</option>
                    <option value="en_cours">{t('statut_en_cours')}</option>
                    <option value="traite">{t('statut_traite')}</option>
                  </select>
                  <span className={`inline-block w-3 h-3 rounded-full ml-2 ${STATUS_DOT[row.statut]}`} />
                </td>
                <td className="p-2">{row.domaine_id}</td>
                <td className="p-2">{row.type_id}</td>
                <td className="p-2">{row.epic_id}</td>
                <td className="p-2"><a href={row.lien_url} target="_blank" rel="noopener noreferrer">{row.lien_url}</a></td>
                <td className="p-2">{row.gps_lat ?? ''},{row.gps_lng ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="p-6 text-center text-gray-500">{t('vide')}</div>}
      </div>

      <div className="flex items-center justify-between">
        <div>
          {t('total')}: {pagination.total}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={pagination.page <= 1} onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}>G</button>
          <span>{pagination.page}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}>P</button>
          <span>/ {pagination.totalPages}</span>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <select id="bulk-status-select" defaultValue="en_cours">
              <option value="en_cours">{t('statut_en_cours')}</option>
              <option value="traite">{t('statut_traite')}</option>
              <option value="non_traite">{t('statut_non_traite')}</option>
            </select>
            <button onClick={() => bulkChangeStatus(document.getElementById('bulk-status-select').value)}>{t('changerStatut')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
