/**
 * Service d'affectation automatique des agents par daïra.
 * Un seul titulaire actif par daïra (unicité via index partiel).
 * Règles :
 * 1. Création/import → titulaire actif de la daïra → agent_id, agent_source='auto'
 * 2. Titulaire inactif/absent → suppléant actif ; aucun → non affectée + alerte admin
 * 3. Changement daïra (non traitée) → réaffectation auto ; traitée → agent conservé
 * 4. Surcharge manuelle (motif obligatoire) → agent_source='manuel' (non écrasée par auto)
 * 5. Changement titulaire (admin) : aperçu + confirmation explicite
 * 6. Outil admin "Affecter les anomalies existantes" : aperçu puis confirmation
 */

export function getActiveTitulaire(db, dairaId) {
  return db.prepare(`
    SELECT a.id, a.full_name, a.matricule
    FROM affectations_agents aa
    JOIN agents a ON a.id = aa.agent_id
    WHERE aa.daira_id = ? AND aa.role = 'titulaire' AND aa.actif = 1 AND a.actif = 1
    ORDER BY aa.created_at DESC LIMIT 1
  `).get(dairaId);
}

export function getActiveSuppleant(db, dairaId) {
  return db.prepare(`
    SELECT a.id, a.full_name, a.matricule
    FROM affectations_agents aa
    JOIN agents a ON a.id = aa.agent_id
    WHERE aa.daira_id = ? AND aa.role = 'suppleant' AND aa.actif = 1 AND a.actif = 1
    ORDER BY aa.created_at DESC LIMIT 1
  `).get(dairaId);
}

/**
 * Affecte l'agent à une anomalie selon les règles métier.
 * Retourne { agent_id, agent_source, agent_affecte_le, reassigned: boolean }.
 * Ne commet pas — le caller gère la transaction.
 */
export function affecterAgent(db, anomalieId, options = {}) {
  const {
    daira_id,
    manualAgentId = null, 
    manualMotif = null,
    user_id = null,
    skipIfManuel = true,
    bumpVersion = true,
  } = options;

  // Récupérer l'anomalie actuelle
  const anomalie = db.prepare('SELECT id, agent_id, agent_source, daira_id, statut FROM anomalies WHERE id = ?').get(anomalieId);
  if (!anomalie) throw new Error('Anomalie introuvable');

  // Si déjà affectée manuellement et qu'on ne force pas, ne pas écraser
  if (skipIfManuel && anomalie.agent_source === 'manuel') {
    return { agent_id: anomalie.agent_id, agent_source: 'manuel', agent_affecte_le: anomalie.agent_affecte_le, reassigned: false, blocked: 'manuel' };
  }

  // Déterminer l'agent cible
  let agent = null;
  let agent_source = 'auto';

  if (manualAgentId) {
    // Surcharge manuelle explicite
    agent = db.prepare('SELECT id, full_name FROM agents WHERE id = ? AND actif = 1').get(manualAgentId);
    if (!agent) throw new Error('Agent manuel inactif ou introuvable');
    agent_source = 'manuel';
  } else if (daira_id) {
    // Affectation automatique par daïra
    agent = getActiveTitulaire(db, daira_id);
    if (!agent) {
      agent = getActiveSuppleant(db, daira_id);
      if (agent) agent_source = 'auto'; // suppléant compte comme auto
    }
    if (!agent) {
      // Aucun agent → non affectée (agent_id = NULL)
      agent_source = 'auto';
    }
  }

  const agent_id = agent?.id || null;
  const agent_affecte_le = new Date().toISOString();

  // Mettre à jour l'anomalie
  const changes = [];
  if (anomalie.agent_id !== agent_id) {
    changes.push({ champ: 'agent_id', avant: anomalie.agent_id, apres: agent_id });
  }
  if (anomalie.agent_source !== agent_source) {
    changes.push({ champ: 'agent_source', avant: anomalie.agent_source, apres: agent_source });
  }
  if (anomalie.agent_affecte_le !== agent_affecte_le) {
    changes.push({ champ: 'agent_affecte_le', avant: anomalie.agent_affecte_le, apres: agent_affecte_le });
  }
  if (manualMotif && anomalie.agent_motif !== manualMotif) {
    changes.push({ champ: 'agent_motif', avant: anomalie.agent_motif, apres: manualMotif });
  }

  if (changes.length) {
    db.prepare(`
      UPDATE anomalies
      SET agent_id = ?, agent_source = ?, agent_affecte_le = ?, agent_motif = COALESCE(?, agent_motif)${bumpVersion ? ', version = version + 1' : ''}
      WHERE id = ?
    `).run(agent_id, agent_source, agent_affecte_le, manualMotif, anomalieId);

    // Historique (schéma V5 : champ / ancienne_valeur / nouvelle_valeur / motif).
    if (user_id) {
      db.prepare(`INSERT INTO anomalie_historique(anomalie_id, champ, ancienne_valeur, nouvelle_valeur, motif, user_id)
                  VALUES (?, ?, ?, ?, ?, ?)`).run(
        anomalieId, 'agent_id',
        anomalie.agent_id === null ? null : String(anomalie.agent_id),
        agent_id === null ? null : String(agent_id),
        manualMotif || 'Affectation automatique', user_id,
      );
    }
  }

  return { agent_id, agent_source, agent_affecte_le, reassigned: changes.length > 0, changes };
}

/**
 * Réaffecte toutes les anomalies ouvertes d'une daïra suite à un changement de titulaire.
 * Retourne { preview: number, updated: number }.
 */
export function reaffecterDaïra(db, dairaId, newAgentId, user_id) {
  const anomalies = db.prepare(`
    SELECT id, agent_id, agent_source, statut
    FROM anomalies
    WHERE daira_id = ? AND deleted_at IS NULL AND statut IN ('non_traite', 'en_cours')
  `).all(dairaId);

  const toUpdate = anomalies.filter(a => a.agent_source !== 'manuel' || a.agent_id !== newAgentId);
  const preview = toUpdate.length;
  let updated = 0;

  if (preview > 0) {
    db.transaction(() => {
      for (const a of toUpdate) {
        const res = affecterAgent(db, a.id, { daira_id: dairaId, manualAgentId: newAgentId, user_id, skipIfManuel: false });
        if (res.reassigned) updated++;
      }
    })();
  }

  return { preview, updated };
}

/**
 * Backfill : affecte les anomalies existantes sans agent (non traitées et en cours par défaut).
 * Option includeTraitées pour inclure les traitées.
 */
export function backfillAffectations(db, options = {}) {
  const { includeTraitees = false, user_id = null } = options;
  const statuts = includeTraitees ? ['non_traite', 'en_cours', 'traite'] : ['non_traite', 'en_cours'];
  const placeholders = statuts.map(() => '?').join(',');
  
  const anomalies = db.prepare(`
    SELECT id, daira_id, statut, agent_source
    FROM anomalies
    WHERE agent_id IS NULL AND deleted_at IS NULL AND statut IN (${placeholders})
  `).all(...statuts);

  let affected = 0;
  const errors = [];

  for (const a of anomalies) {
    try {
      const res = affecterAgent(db, a.id, { daira_id: a.daira_id, user_id });
      if (res.agent_id) affected++;
      else errors.push({ id: a.id, reason: 'Aucun agent pour cette daïra' });
    } catch (e) {
      errors.push({ id: a.id, reason: e.message });
    }
  }

  return { total: anomalies.length, affected, errors };
}

/**
 * Importe un CSV d'affectations : daira;nom_agent;matricule;role
 * Retourne { created, updated, errors }
 */
export function importAffectationsCSV(db, csvText, user_id) {
  const lines = csvText.trim().split('\n');
  const header = lines[0].toLowerCase();
  if (!header.includes('daira') || !header.includes('nom_agent')) {
    throw new Error('En-tête CSV invalide. Attendu: daira;nom_agent;matricule;role');
  }

  let created = 0, updated = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const [dairaName, nomAgent, matricule, role = 'titulaire'] = lines[i].split(';').map(s => s.trim());
    if (!dairaName || !nomAgent) {
      errors.push({ ligne: i + 1, message: 'Daïra et nom agent requis' });
      continue;
    }

    const daira = db.prepare('SELECT id FROM dairas WHERE name_fr = ? OR name_ar = ?').get(dairaName, dairaName);
    if (!daira) {
      errors.push({ ligne: i + 1, message: `Daïra inconnue: ${dairaName}` });
      continue;
    }

    let agent = null;
    if (matricule) {
      agent = db.prepare('SELECT id FROM agents WHERE matricule = ? AND actif = 1').get(matricule);
    }
    if (!agent) {
      agent = db.prepare('SELECT id FROM agents WHERE full_name = ? AND actif = 1').get(nomAgent);
    }
    if (!agent) {
      errors.push({ ligne: i + 1, message: `Agent introuvable: ${nomAgent} (matricule: ${matricule || '—'})` });
      continue;
    }

    // Désactiver l'ancien titulaire/supplant de cette daïra pour ce rôle
    db.prepare(`
      UPDATE affectations_agents SET actif = 0, motif = 'Remplacé par import', updated_at = datetime('now')
      WHERE daira_id = ? AND role = ? AND actif = 1
    `).run(daira.id, role);

    // Créer la nouvelle affectation
    const existing = db.prepare('SELECT id FROM affectations_agents WHERE daira_id = ? AND agent_id = ? AND role = ?').get(daira.id, agent.id, role);
    if (existing) {
      db.prepare('UPDATE affectations_agents SET actif = 1, motif = NULL, updated_at = datetime("now") WHERE id = ?').run(existing.id);
      updated++;
    } else {
      db.prepare(`
        INSERT INTO affectations_agents (daira_id, agent_id, role, du, actif, cree_par)
        VALUES (?, ?, ?, date('now'), 1, ?)
      `).run(daira.id, agent.id, role, user_id);
      created++;
    }
  }

  return { created, updated, errors };
}