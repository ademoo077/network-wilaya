export async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Trop de requêtes, veuillez réessayer dans quelques instants.');
    }
    throw new Error((data && data.error && data.error.message) || 'Erreur API');
  }
  return data;
}
