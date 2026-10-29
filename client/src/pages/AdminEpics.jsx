import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function AdminEpics() {
  const [epics, setEpics] = useState([]);
  const [domaines, setDomaines] = useState([]);
  const [selectedEpic, setSelectedEpic] = useState(null);
  const [selectedDomaines, setSelectedDomaines] = useState([]);
  const [form, setForm] = useState({ name: '', sigle: '', contactNom: '', contactTel: '' });
  const [msg, setMsg] = useState(null);

  async function loadEpics() {
    const d = await apiFetch('/admin/references/epics').catch(() => ({ data: [] }));
    setEpics(d.data || []);
  }
  async function loadDomaines() {
    const d = await apiFetch('/admin/references/domaines').catch(() => ({ data: [] }));
    setDomaines(d.data || []);
  }
  async function loadEpicDomaines(epicId) {
    const d = await apiFetch('/admin/references/epics/' + epicId + '/domaines').catch(() => ({ data: [] }));
    setSelectedDomaines(d.data || []);
  }

  useEffect(() => { loadEpics(); loadDomaines(); }, []);
  useEffect(() => { if (selectedEpic) loadEpicDomaines(selectedEpic.id); }, [selectedEpic]);

  async function createEpic(e) {
    e.preventDefault(); setMsg(null);
    try { await apiFetch('/admin/references/epics', { method: 'POST', body: form }); setForm({ name: '', sigle: '', contactNom: '', contactTel: '' }); await loadEpics(); setMsg('EPIC créé.'); }
    catch (err) { setMsg(err.message); }
  }
  async function saveDomaines() {
    if (!selectedEpic) return;
    setMsg(null);
    try { await apiFetch('/admin/references/epics/' + selectedEpic.id + '/domaines', { method: 'PUT', body: { domaineIds: selectedDomaines } }); setMsg('Compétences enregistrées.'); }
    catch (err) { setMsg(err.message); }
  }
  function toggleDomaine(id) {
    setSelectedDomaines((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
        <h2 className="text-lg font-bold text-[var(--ink)]">EPICs</h2>
        {msg && <div className="text-sm text-[var(--ink-2)]">{msg}</div>}
        <form onSubmit={createEpic} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
          <input value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} placeholder="Sigle" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
          <input value={form.contactNom} onChange={(e) => setForm({ ...form, contactNom: e.target.value })} placeholder="Contact" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
          <input value={form.contactTel} onChange={(e) => setForm({ ...form, contactTel: e.target.value })} placeholder="Téléphone" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
          <button type="submit" className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm md:col-span-2">Ajouter</button>
        </form>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">ID</th><th className="p-2 text-start">Nom</th><th className="p-2 text-start">Sigle</th><th className="p-2 text-start">Action</th></tr></thead>
            <tbody>
              {epics.map((e) => (
                <tr key={e.id} className={`border-t border-[var(--border)] ${selectedEpic?.id === e.id ? 'bg-[var(--brand-50)]' : ''}`}>
                  <td className="p-2">{e.id}</td>
                  <td className="p-2">{e.name}</td>
                  <td className="p-2">{e.sigle}</td>
                  <td className="p-2"><button onClick={() => setSelectedEpic(e)} className="text-[var(--brand-600)] underline text-xs">Compétences</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
        <h2 className="text-lg font-bold text-[var(--ink)]">Compétences {selectedEpic ? '— ' + selectedEpic.name : ''}</h2>
        {selectedEpic && (
          <>
            <p className="text-sm text-[var(--muted)]">Sélectionnez les catégories d'anomalies concernées par cet EPIC.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
              {domaines.map((d) => (
                <label key={d.id} className="flex items-center gap-2 p-2 rounded-[var(--r-md)] hover:bg-[var(--brand-50)] cursor-pointer">
                  <input type="checkbox" checked={selectedDomaines.includes(d.id)} onChange={() => toggleDomaine(d.id)} />
                  <span className="text-sm text-[var(--ink)]">{d.name_ar}</span>
                </label>
              ))}
            </div>
            <button onClick={saveDomaines} className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Enregistrer les compétences</button>
          </>
        )}
        {!selectedEpic && <div className="text-sm text-[var(--muted)]">Sélectionnez un EPIC pour gérer ses compétences.</div>}
      </div>
    </div>
  );
}