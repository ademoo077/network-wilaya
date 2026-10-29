import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';
import { Button, Card, CardBody, EmptyState, Pagination, Skeleton } from '../components/ui';

const STATUS_DOT = { non_traite: 'bg-[var(--st-non)]', en_cours: 'bg-[var(--st-cours)]', traite: 'bg-[var(--st-traite)]' };

export default function AnomaliesList({ onOpen, filters, setFilters }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domaines, setDomaines] = useState([]);
  const [types, setTypes] = useState([]);
  const [dairas, setDairas] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [epics, setEpics] = useState([]);
  const [agents, setAgents] = useState([]);

  const domaineMap = useMemo(() => Object.fromEntries(domaines.map((d) => [d.id, d])), [domaines]);
  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);
  const dairaMap = useMemo(() => Object.fromEntries(dairas.map((d) => [d.id, d])), [dairas]);
  const communeMap = useMemo(() => Object.fromEntries(communes.map((c) => [c.id, c])), [communes]);
  const epicMap = useMemo(() => Object.fromEntries(epics.map((e) => [e.id, e])), [epics]);

  const filtersState = useMemo(() => filters || { page: 1, pageSize: 25 }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    const f = filtersState;
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    try {
      const data = await apiFetch('/anomalies?' + params.toString());
      setItems(data.data);
      setPagination(data.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filtersState]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/references/domaines').then((d) => setDomaines(d.data)).catch(() => {});
    apiFetch('/references/dairas').then((d) => setDairas(d.data)).catch(() => {});
    apiFetch('/references/epics').then((d) => setEpics(d.data)).catch(() => {});
    apiFetch('/references/agents').then((d) => setAgents(d.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (filtersState.domaineId) {
      apiFetch('/references/types?domaineId=' + filtersState.domaineId).then((d) => setTypes(d.data)).catch(() => {});
    } else {
      apiFetch('/references/types').then((d) => setTypes(d.data)).catch(() => {});
    }
  }, [filtersState.domaineId]);

  useEffect(() => {
    if (filtersState.dairaId) {
      apiFetch('/references/communes?dairaId=' + filtersState.dairaId).then((d) => setCommunes(d.data)).catch(() => {});
    } else {
      apiFetch('/references/communes').then((d) => setCommunes(d.data)).catch(() => {});
    }
  }, [filtersState.dairaId]);

  async function changeStatus(id, statut) {
    const row = items.find((r) => r.id === id);
    const patch = { statut };
    if ((statut === 'en_cours' || statut === 'traite') && !row?.epic_id) {
      const epic = window.prompt('EPIC requis (id) pour ce statut :', '');
      if (!epic) return;
      patch.epicId = Number(epic);
    }
    try {
      await apiFetch(`/anomalies/${id}`, { method: 'PATCH', body: patch });
      await load();
    } catch (e) {
      alert(e.message);
    }
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

  function updateFilters(patch) {
    const next = { ...filtersState, ...patch };
    if (setFilters) setFilters(next);
  }

  function resetFilters() {
    if (setFilters) setFilters({ page: 1, pageSize: filtersState.pageSize });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">Anomalies</h1>
          <p className="text-sm text-[var(--muted)]">{pagination.total} résultat(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { /* export */ }}>Exporter</Button>
          <Button onClick={() => (window.location.hash = '#quick')}>Nouvelle anomalie</Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Recherche</label>
              <input value={filtersState.q || ''} onChange={(e) => updateFilters({ q: e.target.value, page: 1 })} placeholder="Lieu, lien, observations…" className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Statut</label>
              <select value={filtersState.statut || ''} onChange={(e) => updateFilters({ statut: e.target.value || undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Tous</option>
                <option value="non_traite">Non traité</option>
                <option value="en_cours">En cours</option>
                <option value="traite">Traité</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Vérification</label>
              <select value={filtersState.verification || ''} onChange={(e) => updateFilters({ verification: e.target.value || undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Tous</option>
                <option value="a_verifier">À vérifier</option>
                <option value="confirmee">Confirmée</option>
                <option value="infirmee">Infirmée</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Catégorie</label>
              <select value={filtersState.domaineId || ''} onChange={(e) => updateFilters({ domaineId: e.target.value ? Number(e.target.value) : undefined, typeId: undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Toutes</option>
                {domaines.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Type</label>
              <select value={filtersState.typeId || ''} onChange={(e) => updateFilters({ typeId: e.target.value ? Number(e.target.value) : undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Tous</option>
                {types.map((ty) => <option key={ty.id} value={ty.id}>{ty.name_ar}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Daïra</label>
              <select value={filtersState.dairaId || ''} onChange={(e) => updateFilters({ dairaId: e.target.value ? Number(e.target.value) : undefined, communeId: undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Toutes</option>
                {dairas.map((d) => <option key={d.id} value={d.id}>{d.name_fr}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Commune</label>
              <select value={filtersState.communeId || ''} onChange={(e) => updateFilters({ communeId: e.target.value ? Number(e.target.value) : undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Toutes</option>
                {communes.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">EPIC</label>
              <select value={filtersState.epicId || ''} onChange={(e) => updateFilters({ epicId: e.target.value ? Number(e.target.value) : undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Tous</option>
                {epics.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Agent</label>
              <select value={filtersState.agentId || ''} onChange={(e) => updateFilters({ agentId: e.target.value ? Number(e.target.value) : undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Tous</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Plateforme</label>
              <select value={filtersState.plateforme || ''} onChange={(e) => updateFilters({ plateforme: e.target.value || undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
                <option value="">Toutes</option>
                {['facebook','instagram','tiktok','youtube','x','whatsapp','telegram','autre'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Du</label>
              <input type="date" value={filtersState.from || ''} onChange={(e) => updateFilters({ from: e.target.value || undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Au</label>
              <input type="date" value={filtersState.to || ''} onChange={(e) => updateFilters({ to: e.target.value || undefined, page: 1 })} className="h-11 w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={resetFilters} className="text-sm text-[var(--brand-600)] hover:underline">Réinitialiser les filtres</button>
          </div>
        </CardBody>
      </Card>

      {selected.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-3)] rounded-[var(--r-lg)] px-4 py-3 flex items-center gap-3 z-30">
          <span className="text-sm font-medium">{selected.length} sélectionnée(s)</span>
          <select id="bulk-status-select" defaultValue="en_cours" className="h-9 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
            <option value="en_cours">En cours</option>
            <option value="traite">Traité</option>
            <option value="non_traite">Non traité</option>
          </select>
          <Button size="sm" onClick={() => bulkChangeStatus(document.getElementById('bulk-status-select').value)}>Appliquer</Button>
          <button onClick={() => setSelected([])} className="text-sm text-[var(--muted)] hover:underline">Annuler</button>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]">
              <tr>
                <th className="p-3 w-8"><input type="checkbox" onChange={(e) => { if (e.target.checked) setSelected(items.map((i) => i.id)); else setSelected([]); }} /></th>
                <th className="text-start p-3">Référence</th>
                <th className="text-start p-3">Date</th>
                <th className="text-start p-3">Statut</th>
                <th className="text-start p-3">Catégorie</th>
                <th className="text-start p-3">Type</th>
                <th className="text-start p-3">Daïra / Commune</th>
                <th className="text-start p-3">EPIC</th>
                <th className="text-start p-3">Vérification</th>
                <th className="text-start p-3">Priorité</th>
                <th className="text-start p-3">Lien</th>
                <th className="text-start p-3">GPS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={12} className="p-3"><Skeleton className="h-6" /></td></tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={12}><EmptyState title="Aucune anomalie" description="Ajustez les filtres ou créez la première anomalie." action={<Button onClick={() => (window.location.hash = '#quick')}>Nouvelle anomalie</Button>} /></td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)] hover:bg-[var(--brand-50)] cursor-pointer transition-colors" onClick={() => onOpen(row.id)}>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} />
                    </td>
                    <td className="p-3 font-mono text-xs">{row.reference}</td>
                    <td className="p-3">{row.date_signalement}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <select value={row.statut} onChange={(e) => changeStatus(row.id, e.target.value)} className="h-9 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-xs">
                        <option value="non_traite">Non traité</option>
                        <option value="en_cours">En cours</option>
                        <option value="traite">Traité</option>
                      </select>
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ms-2 ${STATUS_DOT[row.statut]}`} />
                    </td>
                    <td className="p-3">{domaineMap[row.domaine_id]?.name_ar || row.domaine_id}</td>
                    <td className="p-3">{typeMap[row.type_id]?.name_ar || row.type_id}</td>
                    <td className="p-3">{dairaMap[row.daira_id]?.name_fr || row.daira_id} / {communeMap[row.commune_id]?.name_fr || row.commune_id}</td>
                    <td className="p-3">{row.epic_id ? (epicMap[row.epic_id]?.name || row.epic_id) : '—'}</td>
                    <td className="p-3">{row.verification}</td>
                    <td className="p-3">{row.priorite}</td>
                    <td className="p-3">
                      <a href={row.lien_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[var(--brand-600)] hover:underline">Ouvrir</a>
                    </td>
                    <td className="p-3 text-xs">{row.gps_lat != null ? `${row.gps_lat.toFixed(4)}, ${row.gps_lng.toFixed(4)}` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[var(--border)]">
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPage={(p) => updateFilters({ page: p })} onPageSize={(n) => updateFilters({ pageSize: n, page: 1 })} />
        </div>
      </Card>
    </div>
  );
}