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
        <h2 className="text-xl font-bold mb-4">Administration</h2>
        {msg && <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm">{msg}</div>}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={createBackup} disabled={busy} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Nouvelle sauvegarde</button>
          <button onClick={() => exportFmt('xlsx')} className="bg-green-600 text-white px-3 py-2 rounded text-sm">Export Excel</button>
          <button onClick={() => exportFmt('csv')} className="bg-gray-200 dark:bg-gray-700 px-3 py-2 rounded text-sm">Export CSV</button>
        </div>
        <h3 className="text-lg font-bold mb-2">Sauvegardes</h3>
        <ul className="space-y-1 text-sm">
          {backups.map((b) => (
            <li key={b.filename} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 py-1">
              <span>{b.filename}</span>
              <button onClick={() => restore(b.filename)} className="text-blue-600 underline text-xs">Restaurer</button>
            </li>
          ))}
          {backups.length === 0 && <li className="text-gray-500">Aucune sauvegarde</li>}
        </ul>
      </div>
      <div className="bg-[var(--surface)] rounded-[var(--r-lg)] shadow-[var(--shadow-1)] border border-[var(--border)] p-6">
        <h3 className="text-lg font-bold mb-2">Journal d'audit</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-2">Date</th><th className="p-2">Action</th><th className="p-2">Entité</th><th className="p-2">ID</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-2">{a.at}</td>
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
