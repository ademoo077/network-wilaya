const memory = new Map();
export function readDraft(key) {
  try {
    const draft = JSON.parse(localStorage.getItem(key)) || memory.get(key) || null;
    return draft?.values && typeof draft.values === 'object' && !Array.isArray(draft.values) ? draft : null;
  } catch { return memory.get(key) || null; }
}
export function saveDraft(key, value) {
  memory.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); return 'saved'; } catch { return 'memory'; }
}
export function clearDraft(key) {
  memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* repli mémoire */ }
}
