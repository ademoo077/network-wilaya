import { api } from '../../api/client.js';

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
    return { ...item, source_modele_id: response.source || modele.id };
  } catch (error) {
    if (error.status !== 404 || modele.portee !== 'systeme') throw error;
    const { items = [] } = await api('/syntheses/modeles');
    const source = items.find((item) => item.id === modele.id)
      || items.find((item) => modele.cle_systeme && item.cle_systeme === modele.cle_systeme);
    if (!source) throw error;
    const nom = personalizedName(source);
    const existing = items.find((item) => item.portee !== 'systeme' && item.nom === nom && item.est_proprietaire !== false);
    if (existing) return { ...existing, source_modele_id: source.id };
    const response = await api(`/syntheses/modeles/${source.id}/dupliquer`, {
      method: 'POST', body: { nom, portee: 'prive' },
    });
    return { ...(response.item || response), source_modele_id: source.id };
  }
}
