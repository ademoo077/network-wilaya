import { describe, it, expect, beforeAll } from 'vitest';
import {
  CATALOGUE, DIMENSIONS, FILTRES, MEASURES, measureCompatible,
} from '@anm/shared';
import { createAnomalie } from '../src/services/anomalies.js';
import { evaluateSynthese, clearSyntheseCache } from '../src/synthese/engine.js';
import { freshDatabase } from './helpers.js';

const TODAY = '2026-11-15';
const DEBUT = '2026-11-09';
const FIN = '2026-11-15';

let db;
let refs;
let userIds;
let groupeId;

function spec(overrides) {
  return {
    dataset: 'anomalies',
    mesures: [{ id: 'recues' }],
    dimensions: [],
    filtres: [],
    periode: { mode: 'plage', debut: DEBUT, fin: FIN },
    ...overrides,
  };
}

function essai(label, requete) {
  try {
    return evaluateSynthese(db, requete, { today: TODAY });
  } catch (error) {
    throw new Error(`${label} : ${error.message}`, { cause: error });
  }
}

beforeAll(() => {
  ({ db, refs, userIds } = freshDatabase());
  clearSyntheseCache();

  const anomalie = createAnomalie(db, {
    lien_url: 'https://www.facebook.com/anm/catalogue/1',
    date_signalement: '2026-11-10',
    date_publication: '2026-11-09',
    date_verification: '2026-11-11',
    date_intervention: '2026-11-12',
    date_traitement: '2026-11-13',
    domaine_id: refs.domaineId,
    type_id: refs.typeId,
    daira_id: refs.dairaId,
    commune_id: refs.communeId,
    adresse_texte: 'Rue de test',
    verification: 'confirmee',
    agent_id: refs.agentId,
    epic_id: refs.epicId,
    statut: 'traite',
    priorite: 'urgente',
    plateforme: 'facebook',
    contenu_type: 'post',
    gps: { lat: 36.7538, lng: 3.0588 },
    gps_source: 'manuel',
    gps_verifiee: true,
    motif: 'Test catalogue',
  }, userIds.admin, { today: TODAY });

  db.prepare(`INSERT INTO pieces_jointes(anomalie_id, chemin, nom_original, mime, taille, user_id)
              VALUES (?, 'test/photo.jpg', 'photo.jpg', 'image/jpeg', 1024, ?)`)
    .run(anomalie.id, userIds.admin);

  const domaine = db.prepare('SELECT groupe_id FROM domaines WHERE id = ?').get(refs.domaineId);
  groupeId = domaine?.groupe_id ?? null;
});

describe('catalogue V8 — chaque mesure compile et s’évalue', () => {
  it('évalue toutes les mesures sans dimension', () => {
    for (const mesure of MEASURES) {
      const result = essai(`mesure ${mesure.id}`, spec({ mesures: [{ id: mesure.id }] }));
      expect(result.colonnes.mesures.map((item) => item.id)).toEqual([mesure.id]);
      expect(result.lignes.length, mesure.id).toBe(1);
    }
  });

  it('évalue chaque mesure sur chaque dimension compatible', () => {
    for (const mesure of MEASURES) {
      for (const dimension of DIMENSIONS) {
        if (!measureCompatible(mesure.id, dimension.id)) continue;
        const ref = { champ: dimension.id };
        if (dimension.kind === 'time') ref.granularite = 'jour';
        const result = essai(`mesure ${mesure.id} × dimension ${dimension.id}`, spec({
          mesures: [{ id: mesure.id }],
          dimensions: [ref],
        }));
        expect(result.colonnes.dimensions[0].id).toBe(dimension.id);
      }
    }
  });

  it('honore le drapeau totaux', () => {
    const avec = essai('totaux true', spec({ totaux: true }));
    const sans = essai('totaux false', spec({ totaux: false }));
    expect(avec.totaux.valeurs.recues).toBe(1);
    expect(sans.totaux).toBeNull();
  });
});

describe('catalogue V8 — chaque filtre compile pour chaque opérateur', () => {
  const valeurs = () => ({
    domaine: refs.domaineId,
    groupe: groupeId,
    type: refs.typeId,
    daira: refs.dairaId,
    commune: refs.communeId,
    epic: refs.epicId,
    agent: refs.agentId,
    saisi_par: userIds.admin,
    statut: 'traite',
    verification: 'confirmee',
    priorite: 'urgente',
    plateforme: 'facebook',
    contenu_type: 'post',
    source_saisie: 'manuelle',
    gps_source: 'manuel',
    tranche_age: '0-7',
    tranche_delai: '0-2',
    gps: true,
    gps_verifiee: true,
    recurrent: false,
    a_pieces_jointes: true,
    en_retard: false,
    hors_sla: false,
    urgentes: true,
    signalement: '2026-11-10',
    traitement: '2026-11-13',
    date_verification: '2026-11-11',
    intervention: '2026-11-12',
    publication: '2026-11-09',
    q: 'test',
  });

  it('évalue chaque filtre et chaque opérateur autorisé', () => {
    const byId = valeurs();
    for (const filtre of FILTRES) {
      const valeur = byId[filtre.id];
      for (const op of filtre.ops) {
        let candidate = valeur;
        if (op === 'in' || op === 'not_in') candidate = [valeur];
        if (op === 'between') candidate = [valeur, valeur];
        if (op === 'is_null') candidate = true;
        if (filtre.id === 'q' && op === 'contains') candidate = 'test';
        const result = essai(`filtre ${filtre.id} (${op})`, spec({
          filtres: [{ champ: filtre.id, op, valeur: candidate }],
        }));
        expect(result.lignes.length).toBe(1);
      }
    }
  });

  it('expose un champ compilable pour chaque filtre du catalogue', () => {
    for (const filtre of FILTRES) {
      expect(CATALOGUE.filtres[filtre.id], filtre.id).toBeTruthy();
    }
  });
});
