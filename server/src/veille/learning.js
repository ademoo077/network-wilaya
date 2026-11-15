import { aliasCandidates, detectLanguage, normalizeTerm, termCandidates, termsToRemove } from '@anm/shared';

function upsertProposal(db, proposal) {
  const existing = db.prepare(`SELECT id FROM veille_apprentissages
    WHERE type = ? AND terme_norm = ? AND statut = 'propose'`).get(proposal.type, proposal.terme_norm);
  const payload = JSON.stringify(proposal.payload || {});
  if (existing) {
    db.prepare(`UPDATE veille_apprentissages SET occurrences = ?, precision = ?, payload_json = ?, updated_at = ?
      WHERE id = ?`).run(proposal.occurrences || 0, proposal.precision ?? null, payload, new Date().toISOString(), existing.id);
    return false;
  }
  db.prepare(`INSERT INTO veille_apprentissages
    (type, terme, terme_norm, langue, groupe_id, commune_id, occurrences, precision, statut, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'propose', ?)`).run(proposal.type, proposal.terme, proposal.terme_norm,
    proposal.langue || null, proposal.groupe_id || null, proposal.commune_id || null,
    proposal.occurrences || 0, proposal.precision ?? null, payload);
  return true;
}

export function applyLearning(db, elementId, kind, delta = 1) {
  const accepted = kind === 'accept' ? delta : 0;
  const rejected = kind === 'reject' ? delta : 0;
  const rows = db.prepare('SELECT terme_id FROM veille_correspondances WHERE element_id = ?').all(elementId);
  const update = db.prepare(`UPDATE veille_lexique SET vus = MAX(0, vus + ?), acceptes = MAX(0, acceptes + ?),
    rejetes = MAX(0, rejetes + ?), updated_at = ? WHERE id = ?`);
  const at = new Date().toISOString();
  for (const row of rows) update.run(delta, accepted, rejected, at, row.terme_id);
  return rows.length;
}

export function refreshLearning(db, { minVus = 20, maxPrecision = 0.2 } = {}) {
  const lexicon = db.prepare(`SELECT id, terme, terme_norm, langue, role, groupe_id, domaine_id, vus, acceptes, rejetes
    FROM veille_lexique`).all();
  let created = 0;
  for (const term of termsToRemove(lexicon, { minVus, maxPrecision })) {
    if (upsertProposal(db, {
      type: 'terme_retirer', terme: term.terme, terme_norm: term.terme_norm, langue: term.langue,
      groupe_id: term.groupe_id, occurrences: term.vus, precision: term.precision,
      payload: { terme_id: term.id, precision: term.precision },
    })) created += 1;
  }
  const retained = db.prepare("SELECT texte FROM veille_elements WHERE statut = 'retenu' ORDER BY traite_le DESC LIMIT 300").all();
  const texts = retained.map((row) => row.texte);
  for (const candidate of termCandidates(texts, lexicon, { minOccurrences: 3 })) {
    const langue = detectLanguage(candidate.terme);
    if (upsertProposal(db, {
      type: 'terme_candidat', terme: candidate.terme, terme_norm: normalizeTerm(candidate.terme, langue),
      langue, occurrences: candidate.occurrences, payload: { source: 'textes_retenus' },
    })) created += 1;
  }
  for (const candidate of aliasCandidates(texts, lexicon, { minOccurrences: 5 })) {
    if (upsertProposal(db, {
      type: 'alias', terme: candidate.alias, terme_norm: candidate.alias, occurrences: candidate.occurrences,
      payload: { source: 'textes_retenus' },
    })) created += 1;
  }
  return { created, total: db.prepare("SELECT COUNT(*) AS c FROM veille_apprentissages WHERE statut = 'propose'").get().c };
}

export function listLearning(db) {
  return db.prepare(`SELECT a.*, g.name_fr AS groupe_nom, c.name_fr AS commune_nom
    FROM veille_apprentissages a
    LEFT JOIN groupes_domaines g ON g.id = a.groupe_id
    LEFT JOIN communes c ON c.id = a.commune_id
    ORDER BY CASE a.statut WHEN 'propose' THEN 0 ELSE 1 END, a.occurrences DESC, a.id DESC LIMIT 200`).all();
}

export function decideLearning(db, id, accept, user) {
  const item = db.prepare('SELECT * FROM veille_apprentissages WHERE id = ?').get(id);
  if (!item || item.statut !== 'propose') return null;
  const statut = accept ? 'accepte' : 'refuse';
  db.transaction(() => {
    db.prepare('UPDATE veille_apprentissages SET statut = ?, updated_at = ? WHERE id = ?')
      .run(statut, new Date().toISOString(), id);
    if (!accept) return;
    const payload = item.payload_json ? JSON.parse(item.payload_json) : {};
    if (item.type === 'terme_retirer' && payload.terme_id) {
      db.prepare('UPDATE veille_lexique SET actif = 0, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), payload.terme_id);
    } else if (item.type === 'terme_candidat') {
      db.prepare(`INSERT OR IGNORE INTO veille_lexique
        (terme, terme_norm, langue, role, groupe_id, poids, origine)
        VALUES (?, ?, ?, 'theme', ?, 2, 'appris')`).run(item.terme, item.terme_norm, item.langue || 'mix', item.groupe_id || null);
    } else if (item.type === 'alias') {
      db.prepare(`INSERT OR IGNORE INTO veille_alias_lieux(alias, alias_norm, commune_id, daira_id, origine)
        VALUES (?, ?, ?, ?, 'appris')`).run(item.terme, item.terme_norm, item.commune_id || null, null);
    }
    db.prepare(`INSERT INTO veille_decisions(element_id, user_id, action, avant_json, apres_json)
      VALUES (NULL, ?, 'apprentissage', ?, ?)`).run(user?.id || null, JSON.stringify(item), JSON.stringify({ statut }));
  })();
  return db.prepare('SELECT * FROM veille_apprentissages WHERE id = ?').get(id);
}
