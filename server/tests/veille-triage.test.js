import { describe, it, expect, beforeAll } from 'vitest';
import { freshDatabase } from './helpers.js';
import { veilleContext } from '../src/veille/context.js';
import { createVeilleElement } from '../src/veille/ingest.js';
import { getElement, listElements, retainElement, rejectElement, undoElement } from '../src/veille/triage.js';
import { refreshLearning, decideLearning, listLearning } from '../src/veille/learning.js';

let db;
let refs;
let users;
let sourceId;
let source2;

beforeAll(() => {
  ({ db, refs, userIds: users } = freshDatabase());
  sourceId = Number(db.prepare("INSERT INTO veille_sources(type, nom, actif) VALUES ('rss', 'Source test', 1)").run().lastInsertRowid);
  source2 = Number(db.prepare("INSERT INTO veille_sources(type, nom, actif) VALUES ('capture_assistee', 'Capture test', 1)").run().lastInsertRowid);
});

function ingest(overrides = {}, source = sourceId) {
  return createVeilleElement(db, source, {
    id_externe: `test-${Math.random()}`,
    texte: 'Nid de poule à Commune Test', url: 'https://example.dz/post/1', page_nom: 'Page publique test',
    ...overrides,
  }, { context: veilleContext(db) });
}

describe('Triage Veille — collecte et analyse', () => {
  it('crée un élément à qualifier avec suggestion et territoire', () => {
    const result = ingest({ id_externe: 'analyse-1' });
    expect(result.created).toBe(true);
    expect(result.element.statut).toBe('a_qualifier');
    expect(result.analysis.suggestions[0].groupe_id).toBeTruthy();
    expect(result.analysis.territoire.commune_id).toBe(refs.communeId);
    const item = getElement(db, result.element.id);
    expect(item.correspondances.some((match) => match.terme === 'nid de poule')).toBe(true);
  });

  it('est idempotent sur une même source et un même identifiant externe', () => {
    const first = ingest({ id_externe: 'idem-1' });
    const second = ingest({ id_externe: 'idem-1' });
    expect(second.created).toBe(false);
    expect(second.element.id).toBe(first.element.id);
  });

  it('regroupe le même texte copié par deux sources et met à jour l’événement', () => {
    const first = ingest({ id_externe: 'copie-1', url: 'https://example.dz/copie-1', texte: 'Nid de poule à Commune Test, route très dégradée' }, sourceId);
    const second = ingest({ id_externe: 'copie-2', url: 'https://example.dz/copie-2', texte: 'Nid de poule à Commune Test, route très dégradée' }, source2);
    expect(second.element.groupe_doublon_id).toBe(first.element.groupe_doublon_id || first.element.id);
    expect(second.element.evenement_id).toBe(first.element.evenement_id);
    const event = db.prepare('SELECT * FROM veille_evenements WHERE id = ?').get(first.element.evenement_id);
    expect(event.nb_sources).toBeGreaterThanOrEqual(2);
  });

  it('écarte un texte hors zone quand aucun territoire n’est reconnu', () => {
    const result = ingest({ id_externe: 'hors-zone', texte: 'Nid de poule à Oran', url: 'https://example.dz/oran' });
    expect(result.element.statut).toBe('ignore');
    expect(result.element.raison_rejet).toBe('hors_zone');
  });

  it('liste et filtre les éléments à qualifier', () => {
    const list = listElements(db, { statut: 'a_qualifier', page: 1, pageSize: 10 });
    expect(list.total).toBeGreaterThan(0);
    expect(list.items.every((item) => item.statut === 'a_qualifier')).toBe(true);
  });
});

describe('Triage Veille — décisions, annulation et apprentissage', () => {
  it('retient un élément, prépare le formulaire et compte l’acceptation', () => {
    const { element } = ingest({ id_externe: 'retenu-1' });
    const result = retainElement(db, element.id, { id: users.operateur }, { commentaire: 'Pertinent' });
    expect(result.item.statut).toBe('retenu');
    expect(result.prefill.lien_url).toBe('https://example.dz/post/1');
    expect(result.prefill.commune_id).toBe(refs.communeId);
    const term = db.prepare("SELECT * FROM veille_lexique WHERE terme = 'nid de poule'").get();
    expect(term.acceptes).toBeGreaterThan(0);
  });

  it('annule la dernière décision et rétablit les compteurs', () => {
    const { element } = ingest({ id_externe: 'annule-1' });
    const before = getElement(db, element.id).statut;
    retainElement(db, element.id, { id: users.operateur });
    const afterUndo = undoElement(db, element.id, { id: users.operateur }).item;
    expect(afterUndo.statut).toBe(before);
    expect(db.prepare("SELECT annule_le FROM veille_decisions WHERE element_id = ? ORDER BY id DESC").get(element.id).annule_le).not.toBeNull();
  });

  it('propose le retrait d’un terme après 20 rejets puis permet de le désactiver', () => {
    for (let index = 0; index < 20; index += 1) {
      const { element } = ingest({ id_externe: `rejet-${index}`, texte: `Nid de poule à Commune Test numéro ${index}`, url: `https://example.dz/rejet-${index}` });
      rejectElement(db, element.id, { id: users.operateur }, { raison: 'hors_sujet' });
    }
    refreshLearning(db);
    const proposal = listLearning(db).find((item) => item.type === 'terme_retirer' && item.terme_norm === 'nid de poule');
    expect(proposal).toBeTruthy();
    expect(proposal.precision).toBeLessThan(0.2);
    const accepted = decideLearning(db, proposal.id, true, { id: users.admin });
    expect(accepted.statut).toBe('accepte');
    expect(db.prepare("SELECT actif FROM veille_lexique WHERE terme = 'nid de poule'").get().actif).toBe(0);
  });
});
