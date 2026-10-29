import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

const TABS = ['sauvegardes', 'audit', 'utilisateurs', 'referentiels', 'importexport'];

export default function Admin() {
  const [tab, setTab] = useState('sauvegardes');
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--ink)]">Administration</h1>
      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-[var(--r-md)] text-sm ${tab === t ? 'bg-[var(--brand-600)] text-white' : 'text-[var(--ink-2)] hover:bg-[var(--brand-50)]'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'sauvegardes' && <BackupsTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'utilisateurs' && <UsersTab />}
      {tab === 'referentiels' && <RefsTab />}
      {tab === 'importexport' && <ImportExportTab />}
    </div>
  );
}

function BackupsTab() {
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function load() {
    const b = await apiFetch('/admin/backup').catch(() => ({ data: [] }));
    setBackups(b.data || []);
  }
  useEffect(() => { load(); }, []);
  async function createBackup() {
    setBusy(true); setMsg(null);
    try { const res = await apiFetch('/admin/backup', { method: 'POST' }); setMsg('Sauvegarde créée : ' + res.backup.filename); await load(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  async function restore(filename) {
    if (!window.confirm('Restaurer ' + filename + ' ?')) return;
    setBusy(true); setMsg(null);
    try { await apiFetch('/admin/backup/restore', { method: 'POST', body: { filename } }); setMsg('Restaurée : ' + filename); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
      <div className="flex gap-2">
        <button onClick={createBackup} disabled={busy} className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm disabled:opacity-50">Nouvelle sauvegarde</button>
      </div>
      {msg && <div className="p-2 bg-[var(--surface-2)] rounded text-sm text-[var(--ink-2)]">{msg}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">Fichier</th><th className="p-2 text-start">Actions</th></tr></thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.filename} className="border-t border-[var(--border)]">
                <td className="p-2 text-[var(--ink-2)]">{b.filename}</td>
                <td className="p-2"><button onClick={() => restore(b.filename)} className="text-[var(--brand-600)] underline text-xs">Restaurer</button></td>
              </tr>
            ))}
            {backups.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-[var(--muted)]">Aucune sauvegarde</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const [audit, setAudit] = useState([]);
  useEffect(() => { apiFetch('/admin/audit').then((d) => setAudit(d.data || [])).catch(() => {}); }, []);
  return (
    <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">Date</th><th className="p-2 text-start">Action</th><th className="p-2 text-start">Entité</th><th className="p-2 text-start">ID</th><th className="p-2 text-start">IP</th></tr></thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} className="border-t border-[var(--border)]">
                <td className="p-2 text-[var(--ink-2)]">{a.at}</td>
                <td className="p-2">{a.action}</td>
                <td className="p-2">{a.entite}</td>
                <td className="p-2">{a.entite_id}</td>
                <td className="p-2 text-[var(--muted)]">{a.ip}</td>
              </tr>
            ))}
            {audit.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-[var(--muted)]">Aucun audit</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', role: 'operateur' });
  const [msg, setMsg] = useState(null);
  async function load() { const d = await apiFetch('/admin/users').catch(() => ({ data: [] })); setUsers(d.data || []); }
  useEffect(() => { load(); }, []);
  async function create(e) {
    e.preventDefault(); setMsg(null);
    try { await apiFetch('/admin/users', { method: 'POST', body: form }); setMsg('Utilisateur créé.'); setForm({ username: '', fullName: '', password: '', role: 'operateur' }); await load(); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h3 className="text-lg font-bold mb-3 text-[var(--ink)]">Nouvel utilisateur</h3>
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Identifiant" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nom complet" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mot de passe" className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="admin">admin</option>
            <option value="operateur">operateur</option>
            <option value="lecteur">lecteur</option>
          </select>
          <button type="submit" className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm md:col-span-4">Créer</button>
        </form>
        {msg && <div className="mt-2 text-sm text-[var(--ink-2)]">{msg}</div>}
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">Identifiant</th><th className="p-2 text-start">Nom</th><th className="p-2 text-start">Rôle</th><th className="p-2 text-start">Actif</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="p-2">{u.username}</td>
                  <td className="p-2">{u.full_name}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.active ? 'Oui' : 'Non'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RefsTab() {
  const [entite, setEntite] = useState('domaines');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  async function load() {
    const d = await apiFetch('/admin/references/' + entite).catch(() => ({ data: [] }));
    setRows(d.data || []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); setForm({}); }, [entite]);
  async function create(e) {
    e.preventDefault(); setMsg(null);
    try { await apiFetch('/admin/references/' + entite, { method: 'POST', body: form }); setMsg('Créé.'); setForm({}); await load(); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['domaines', 'types', 'dairas', 'communes', 'epics', 'agents'].map((e) => (
          <button key={e} onClick={() => setEntite(e)} className={`px-3 py-1.5 rounded-[var(--r-md)] text-sm ${entite === e ? 'bg-[var(--brand-600)] text-white' : 'text-[var(--ink-2)] hover:bg-[var(--brand-50)]'}`}>{e}</button>
        ))}
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <div className="text-sm text-[var(--muted)] mb-2">Création (champs JSON) — utilisez les clés attendues par l'API (ex. nameAr, nameFr, ordre pour domaines).</div>
        <form onSubmit={create} className="flex gap-2">
          <input value={JSON.stringify(form)} onChange={(e) => { try { setForm(JSON.parse(e.target.value)); } catch { /* ignore */ } }} className="flex-1 h-11 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-mono" />
          <button type="submit" className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Créer</button>
        </form>
        {msg && <div className="mt-2 text-sm text-[var(--ink-2)]">{msg}</div>}
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">ID</th><th className="p-2 text-start">Données</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="p-2">{r.id}</td>
                  <td className="p-2 font-mono text-xs">{JSON.stringify(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ImportExportTab() {
  const [msg, setMsg] = useState(null);
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { setMsg('JSON invalide'); return; }
    try { const res = await apiFetch('/admin/references/import/taxonomie', { method: 'POST', body: parsed }); setMsg(`Importé : ${res.insertedDomaines?.length || 0} domaines, ${res.insertedTypes?.length || 0} types.`); }
    catch (err) { setMsg(err.message); }
  }
  async function exportFmt(format) {
    const res = await fetch('/api/admin/anomalies/export?format=' + format, { credentials: 'same-origin' });
    if (!res.ok) { setMsg('Export impossible'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'anomalies.' + (format === 'xlsx' ? 'xlsx' : 'csv'); a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
        <h3 className="text-lg font-bold text-[var(--ink)]">Import taxonomie (JSON)</h3>
        <input type="file" accept="application/json" onChange={handleImport} className="text-sm" />
        {msg && <div className="text-sm text-[var(--ink-2)]">{msg}</div>}
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6 space-y-3">
        <h3 className="text-lg font-bold text-[var(--ink)]">Export anomalies</h3>
        <div className="flex gap-2">
          <button onClick={() => exportFmt('xlsx')} className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Excel</button>
          <button onClick={() => exportFmt('csv')} className="bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--border)] px-3 py-2 rounded-[var(--r-md)] text-sm">CSV</button>
        </div>
      </div>
    </div>
  );
}