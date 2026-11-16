import { api } from '../../api/client.js';
import { queryClient } from '../../api/queryClient.js';

/** Une copie créée doit être connue du studio avant la navigation vers son identifiant. */
export async function rememberModel(item) {
  const listKey = ['api', '/syntheses/modeles'];
  await queryClient.cancelQueries({ queryKey: listKey, exact: true });
  const newest = (current) => current && Number(current.version) > Number(item.version) ? current : item;
  queryClient.setQueryData(['api', `/syntheses/modeles/${item.id}`], (data) => ({ item: newest(data?.item) }));
  queryClient.setQueryData(listKey, (data) => data ? {
    ...data, items: [...(data.items || []).filter((entry) => entry.id !== item.id), newest(data.items?.find((entry) => entry.id === item.id))],
  } : data);
  return item;
}

export function personalizedName(modele) {
  return modele.cle_systeme === 'hebdomadaire'
    ? 'Ma synthèse hebdomadaire'
    : `Ma synthèse — ${modele.nom}`;
}

/** Compatibilité avec un serveur lancé avant l'ajout de copy-on-write. */
export async function personalizeModel(modele) {
  try {
    const response = await api(`/syntheses/modeles/${modele.id}/personnaliser`, { method: 'POST' });
    const item = response.item || response;
    return rememberModel({ ...item, source_modele_id: response.source || modele.id });
  } catch (error) {
    if (error.status !== 404 || modele.portee !== 'systeme') throw error;
    const { items = [] } = await api('/syntheses/modeles');
    const source = items.find((item) => item.id === modele.id)
      || items.find((item) => modele.cle_systeme && item.cle_systeme === modele.cle_systeme);
    if (!source) throw error;
    const nom = personalizedName(source);
    const existing = items.find((item) => item.portee !== 'systeme' && item.nom === nom && item.est_proprietaire !== false);
    if (existing) return rememberModel({ ...existing, source_modele_id: source.id });
    const response = await api(`/syntheses/modeles/${source.id}/dupliquer`, {
      method: 'POST', body: { nom, portee: 'prive' },
    });
    return rememberModel({ ...(response.item || response), source_modele_id: source.id });
  }
}

function rejectsUnknownVersion(error) {
  if (error.status !== 400 || error.code !== 'VALIDATION') return false;
  const fields = error.fields || {};
  if (Object.keys(fields).length !== 1) return false;
  return fields.version === 'Champ inconnu'
    || fields._ === "Unrecognized key(s) in object: 'version'";
}

/** Un ancien processus serveur peut ne pas encore accepter le verrou `version`. */
export async function updateModel(modele, definition) {
  const path = `/syntheses/modeles/${modele.id}`;
  const body = { nom: modele.nom, description: modele.description, definition, version: modele.version };
  let updated;
  try {
    updated = await api(path, { method: 'PUT', body });
  } catch (error) {
    // Un conflit ou une valeur de version invalide ne doit jamais désactiver le verrou.
    if (body.version === undefined || !rejectsUnknownVersion(error)) throw error;
    const { version: _version, ...legacyBody } = body;
    updated = await api(path, { method: 'PUT', body: legacyBody });
  }
  await rememberModel(updated.item || updated);
  return updated;
}
