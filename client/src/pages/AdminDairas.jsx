import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function AdminDairas() {
  const [dairas, setDairas] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [selectedDaira, setSelectedDaira] = useState(null);
  const [dairaForm, setDairaForm] = useState({ nameFr: '', nameAr: '' });
  const [communeForm, setCommuneForm] = useState({ nameFr: '', nameAr: '' });
  const [msg, setMsg] = useState(null);

  async function loadDairas() {
    const d = await apiFetch('/admin/references/dairas').catch(() => ({ data: [] }));
    setDairas(d.data || []);
  }
  async function loadCommunes(dairaId) {
    const d = await apiFetch('/admin/references/communes?dairaId=' + dairaId).catch(() => ({ data: [] }));
    setCommunes(d.data || []);
  }

  useEffect(() => { loadDairas(); }, []);
  useEffect(() => { if (selectedDaira) loadCommunes(selectedDaira.id); }, [selectedDaira]);

  async function createDaira(e) {
    e.preventDefault(); setMsg(null);
    try { await apiFetch('/admin/references/dairas', { method: 'POST', body: dairaForm }); setDairaForm({ nameFr: '', nameAr: '' }); await loadDairas(); setMsg('Daïra créée.'); }
    catch (err) { setMsg(err.message); }
  }
  async function createCommune(e) {
    e.preventDefault(); setMsg(null);
    if (!selectedDaira) { setMsg('Sélectionnez une daïra.'); return; }
    try { await apiFetch('/admin/references/communes', { method: 'POST', body: { dairaId: selectedDaira.id, ...communeForm } }); setCommuneForm({ nameFr: '', nameAr: '' }); await loadCommunes(selectedDaira.id); setMsg('Commune créée.'); }
    catch (err) { setMsg(err.message); }
  }
  async function toggleDaira(d, actif) {
    await apiFetch('/admin/references/dairas/' + d.id + '/actif', { method: 'PATCH', body: { actif } });
    await loadDairas();
  }
  async function toggleCommune(c, actif) {
    await apiFetch('/admin/references/communes/' + c.id + '/actif', { method: 'PATCH', body: { actif } });
    if (selectedDaira) await loadCommunes(selectedDaira.id);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
        <h2 className="text-lg font-bold text-[var(--ink)]">Daïras</h2>
        {msg && <div className="text-sm text-[var(--ink-2)]">{msg}</div>}
        <form onSubmit={createDaira} className="flex gap-2">
          <input value={dairaForm.nameFr} onChange={(e) => setDairaForm({ ...dairaForm, nameFr: e.target.value })} placeholder="Nom (FR)" className="h-11 flex-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
          <input value={dairaForm.nameAr} onChange={(e) => setDairaForm({ ...dairaForm, nameAr: e.target.value })} placeholder="Nom (AR)" className="h-11 flex-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
          <button type="submit" className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Ajouter</button>
        </form>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">ID</th><th className="p-2 text-start">Nom FR</th><th className="p-2 text-start">Nom AR</th><th className="p-2 text-start">Actif</th><th className="p-2 text-start">Action</th></tr></thead>
            <tbody>
              {dairas.map((d) => (
                <tr key={d.id} className={`border-t border-[var(--border)] ${selectedDaira?.id === d.id ? 'bg-[var(--brand-50)]' : ''}`}>
                  <td className="p-2">{d.id}</td>
                  <td className="p-2">{d.name_fr}</td>
                  <td className="p-2">{d.name_ar}</td>
                  <td className="p-2">{d.actif ? 'Oui' : 'Non'}</td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => setSelectedDaira(d)} className="text-[var(--brand-600)] underline text-xs">Gérer communes</button>
                    <button onClick={() => toggleDaira(d, d.actif ? 0 : 1)} className="text-xs underline text-[var(--muted)]">{d.actif ? 'Désactiver' : 'Activer'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
        <h2 className="text-lg font-bold text-[var(--ink)]">Communes {selectedDaira ? '— ' + selectedDaira.name_fr : ''}</h2>
        {selectedDaira && (
          <>
            <form onSubmit={createCommune} className="flex gap-2">
              <input value={communeForm.nameFr} onChange={(e) => setCommuneForm({ ...communeForm, nameFr: e.target.value })} placeholder="Nom (FR)" className="h-11 flex-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
              <input value={communeForm.nameAr} onChange={(e) => setCommuneForm({ ...communeForm, nameAr: e.target.value })} placeholder="Nom (AR)" className="h-11 flex-1 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
              <button type="submit" className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Ajouter</button>
            </form>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">ID</th><th className="p-2 text-start">Nom FR</th><th className="p-2 text-start">Nom AR</th><th className="p-2 text-start">Actif</th><th className="p-2 text-start">Action</th></tr></thead>
                <tbody>
                  {communes.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--border)]">
                      <td className="p-2">{c.id}</td>
                      <td className="p-2">{c.name_fr}</td>
                      <td className="p-2">{c.name_ar}</td>
                      <td className="p-2">{c.actif ? 'Oui' : 'Non'}</td>
                      <td className="p-2"><button onClick={() => toggleCommune(c, c.actif ? 0 : 1)} className="text-xs underline text-[var(--muted)]">{c.actif ? 'Désactiver' : 'Activer'}</button></td>
                    </tr>
                  ))}
                  {communes.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-[var(--muted)]">Aucune commune</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!selectedDaira && <div className="text-sm text-[var(--muted)]">Sélectionnez une daïra pour gérer ses communes.</div>}
      </div>
    </div>
  );
}