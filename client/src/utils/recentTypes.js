const memory = new Map();
const key = (userId) => `anm-recent-types:${userId}`;
export function readRecentTypes(userId) {
  try {
    const list = JSON.parse(localStorage.getItem(key(userId))) || memory.get(userId) || [];
    return Array.isArray(list) ? [...new Set(list.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 5) : [];
  } catch { return memory.get(userId) || []; }
}
export function rememberType(userId, typeId) {
  const list = [...new Set([Number(typeId), ...readRecentTypes(userId)])].filter((id) => id > 0).slice(0, 5);
  memory.set(userId, list);
  try { localStorage.setItem(key(userId), JSON.stringify(list)); } catch { /* préférence conservée pour la session */ }
  return list;
}
