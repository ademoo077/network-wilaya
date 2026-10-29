import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

export default function Admin() {
  const [backups, setBackups] = useState([]);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function load() {
    const b = await apiFetch('/admin/backup').catch(() => ({ data: [] }));
    const a = await apiFetch('/admin/audit').catch(() => ({ data: [] }));
    setBackups(b.data || []);
    setAudit(a.data || []);
  }

  useEffect(() => { load(); }, []);

  async function createBackup() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch('/admin/backup', { method: 'POST' });
      setMsg('Sauvegarde créée : ' + res.backup.filename);
      await load();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function restore(filename) {
    if (!window.confirm('Restaurer ' + filename + ' ?')) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch('/admin/backup/restore', { method: 'POST', body: { filename } });
      setMsg('Restaurée : ' + filename);
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function exportFmt(format) {
    const res = await fetch('/api/admin/anomalies/export?format=' + format, { credentials: 'same-origin' });
    if (!res.ok) { setMsg('Export impossible'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anomalies.' + (format === 'xlsx' ? 'xlsx' : 'csv');
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h2 className="text-xl font-bold mb-4 text-[var(--ink)]">Administration</h2>
        {msg && <div className="mb-3 p-3 bg-[var(--surface-2)] rounded-[var(--r-md)] text-sm text-[var(--ink-2)]">{msg}</div>}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={createBackup} disabled={busy} className="bg-[var(--brand-600)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm disabled:opacity-50">Nouvelle sauvegarde</button>
          <button onClick={() => exportFmt('xlsx')} className="bg-[var(--st-traite)] text-white px-3 py-2 rounded-[var(--r-md)] text-sm">Export Excel</button>
          <button onClick={() => exportFmt('csv')} className="bg-[var(--surface-2)] text-[var(--ink)] px-3 py-2 rounded-[var(--r-md)] text-sm border border-[var(--border)]">Export CSV</button>
        </div>
        <h3 className="text-lg font-bold mb-2 text-[var(--ink)]">Sauvegardes</h3>
        <ul className="space-y-1 text-sm">
          {backups.map((b) => (
            <li key={b.filename} className="flex items-center justify-between border-b border-[var(--border)] py-1">
              <span className="text-[var(--ink-2)]">{b.filename}</span>
              <button onClick={() => restore(b.filename)} className="text-[var(--brand-600)] underline text-xs">Restaurer</button>
            </li>
          ))}
          {backups.length === 0 && <li className="text-[var(--muted)]">Aucune sauvegarde</li>}
        </ul>
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h3 className="text-lg font-bold mb-2 text-[var(--ink)]">Journal d'audit</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)]"><tr><th className="p-2 text-start">Date</th><th className="p-2 text-start">Action</th><th className="p-2 text-start">Entité</th><th className="p-2 text-start">ID</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-[var(--border)]">
                  <td className="p-2 text-[var(--ink-2)]">{a.at}</td>
                  <td className="p-2">{a.action}</td>
                  <td className="p-2">{a.entite}</td>
                  <td className="p-2">{a.entite_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}