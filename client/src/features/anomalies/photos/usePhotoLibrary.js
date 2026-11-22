import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client.js';
import { useToast } from '../../../components/ui/index.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { buildZip, downloadBlob } from './zip.js';

const MODE_KEY = (userId) => `anm-photo-mode-${userId || 'anonymous'}`;
export const photoModeKey = MODE_KEY;

export async function compress(file) {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    if (ratio === 1 && file.size <= 5 * 1024 * 1024) { bitmap.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export default function usePhotoLibrary({ anomalieId, pieces, reload }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [mode, setModeState] = useState(() => {
    try { return localStorage.getItem(MODE_KEY(user?.id)) || 'slider'; } catch { return 'slider'; }
  });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY(user?.id));
      if (saved) setModeState(saved);
    } catch { /* stockage indisponible */ }
  }, [user?.id]);
  const setMode = useCallback((value) => {
    setModeState(value);
    try { localStorage.setItem(MODE_KEY(user?.id), value); } catch { /* stockage indisponible */ }
  }, [user?.id]);
  const run = useCallback(async (task) => {
    setBusy(true); setProgress(20); setError('');
    try {
      const result = await task();
      setProgress(90); await reload(); setProgress(100);
      return result;
    } catch (requestError) {
      setError(requestError.message);
      push(requestError.message, 'danger');
      return null;
    } finally {
      window.setTimeout(() => { setBusy(false); setProgress(0); }, 250);
    }
  }, [push, reload]);
  const upload = useCallback((files, role = 'autre', legende = '') => {
    const list = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (!list.length) return Promise.resolve(null);
    return run(async () => {
      for (const [index, file] of list.entries()) {
        setProgress(20 + Math.round((index / list.length) * 60));
        const body = new FormData();
        body.append('file', await compress(file));
        body.append('role', role);
        if (legende.trim()) body.append('legende', legende.trim());
        if (index === 0) body.append('principale', '1');
        await api(`/anomalies/${anomalieId}/pieces`, { method: 'POST', body });
      }
    });
  }, [anomalieId, run]);
  const patch = useCallback((id, body) => run(async () => {
    const result = await api(`/pieces/${id}`, { method: 'PATCH', body });
    return result.item;
  }), [run]);
  const remove = useCallback((id) => run(async () => api(`/pieces/${id}`, { method: 'DELETE', body: {} })), [run]);
  const downloadZip = useCallback(async (ids) => {
    const selected = pieces.filter((piece) => ids.includes(piece.id));
    if (!selected.length) return;
    setBusy(true); setError('');
    try {
      const entries = [];
      for (const [index, piece] of selected.entries()) {
        setProgress(Math.round((index / selected.length) * 80));
        const response = await fetch(piece.url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error(piece.nom_original);
        entries.push({ name: piece.nom_original, bytes: new Uint8Array(await response.arrayBuffer()) });
      }
      downloadBlob(buildZip(entries), `photos-${anomalieId}.zip`);
      setProgress(100);
    } catch (requestError) {
      setError(requestError.message); push(requestError.message, 'danger');
    } finally {
      window.setTimeout(() => { setBusy(false); setProgress(0); }, 250);
    }
  }, [anomalieId, pieces, push]);
  return {
    busy, progress, error, mode, setMode,
    upload, patch, remove, downloadZip,
  };
}
