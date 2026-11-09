import { describe, it, expect, beforeAll } from 'vitest';
import { addDays } from '@anm/shared';
import { detailStats } from '../src/services/statsDetail.js';
import { setup } from './stats-detail-helpers.js';

describe('V5.5 — délais, percentiles et SLA', () => {
  const S = '2026-06-01';
  const E = '2026-06-07';
  let db;
  let refs;

  beforeAll(() => {
    const ctx = setup();
    db = ctx.db;
    refs = ctx.refs;
    // Traitements dans la période avec des délais 1,2,7,8,14,15,30,31.
    for (const [delay, priorite] of [[1, 'urgente'], [2, 'urgente'], [7, 'haute'], [8, 'haute'], [14, 'normale'], [15, 'normale'], [30, 'normale'], [31, 'normale']]) {
      ctx.insert({
        date_signalement: addDays('2026-06-07', -delay),
        date_traitement: '2026-06-07',
        statut: 'traite',
        verification: 'confirmee',
        priorite,
        epic_id: refs.epicId,
        agent_id: refs.agentId,
      });
    }
    // Vérifications dans la période avec des délais 1,2,5.
    for (const delay of [1, 2, 5]) {
      ctx.insert({
        date_signalement: '2026-05-31',
        date_verification: addDays('2026-05-31', delay),
        verification: 'confirmee',
        agent_id: refs.agentId,
      });
    }
  });

  it('calcule moyenne, médiane paire et P90', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.delais.global.total).toBe(8);
    expect(d.delais.global.moyenne).toBe(13.5);
    expect(d.delais.global.mediane).toBe(11);
    expect(d.delais.global.p90).toBe(31);
  });

  it('respecte les bornes des tranches 2/3, 7/8, 14/15, 30/31', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.delais.global.distribution).toEqual({
      j0_2: 2, j3_7: 1, j8_14: 2, j15_30: 2, j30p: 1, total: 8,
    });
  });

  it('applique les SLA par priorité et pour la vérification', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.sla.global.dans_delais).toBe(25);
    expect(d.sla.par_priorite.urgente.dans_delais).toBe(100);
    expect(d.sla.par_priorite.haute.dans_delais).toBe(0);
    expect(d.sla.par_priorite.normale.dans_delais).toBe(0);
    expect(d.sla.verification.total).toBe(3);
    expect(d.sla.verification.dans_delais).toBe(66.7);
  });

  it('retourne une médiane nulle sur une période vide', () => {
    const d = detailStats(db, { from: '2020-01-01', to: '2020-01-07' });
    expect(d.delais.global.total).toBe(0);
    expect(d.delais.global.mediane).toBeNull();
    expect(d.delais.global.p90).toBeNull();
  });
});

describe('V5.5 — entonnoir et ancienneté du stock', () => {
  const S = '2026-07-01';
  const E = '2026-07-07';
  let db;
  let refs;

  beforeAll(() => {
    const ctx = setup();
    db = ctx.db;
    refs = ctx.refs;
    // 1 : à vérifier, non traitée.
    ctx.insert({ date_signalement: '2026-07-07' });
    // 2 : confirmée, non traitée.
    ctx.insert({ date_signalement: '2026-07-01', date_verification: '2026-07-02', verification: 'confirmee', agent_id: refs.agentId });
    // 3 : confirmée, en cours.
    ctx.insert({
      date_signalement: '2026-07-02', date_verification: '2026-07-02',
      verification: 'confirmee', agent_id: refs.agentId,
      statut: 'en_cours', date_intervention: '2026-07-03', epic_id: refs.epicId,
    });
    // 4 : confirmée, traitée.
    ctx.insert({
      date_signalement: '2026-07-03', date_verification: '2026-07-03',
      verification: 'confirmee', agent_id: refs.agentId,
      statut: 'traite', date_intervention: '2026-07-04', date_traitement: '2026-07-05', epic_id: refs.epicId,
    });
    // 5 : infirmée.
    ctx.insert({ date_signalement: '2026-07-04', date_verification: '2026-07-05', verification: 'infirmee', agent_id: refs.agentId });
    // Stock plus ancien (hors cohorte).
    ctx.insert({ date_signalement: '2026-06-15' });
    ctx.insert({ date_signalement: '2026-05-01', reference: 'ANM-OLD' });
    ctx.insert({ date_signalement: '2026-06-25' });
  });

  it('rend l’entonnoir monotone et compte les infirmées à part', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.entonnoir.etapes).toEqual({ recues: 5, verifiees: 4, confirmees: 3, engagees: 2, traitees: 1 });
    expect(d.entonnoir.etapes.confirmees).toBeLessThanOrEqual(d.entonnoir.etapes.verifiees);
    expect(d.entonnoir.etapes.verifiees).toBeLessThanOrEqual(d.entonnoir.etapes.recues);
    expect(d.entonnoir.infirmees).toBe(1);
    expect(d.entonnoir.taux_infirmation).toBe(25);
    expect(d.entonnoir.taux_passage.confirmees).toBe(75);
  });

  it('classe le stock ouvert par ancienneté et priorité', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.anciennete.total).toBe(6);
    expect(d.anciennete.j0_7).toBe(3);
    expect(d.anciennete.j8_14).toBe(1);
    expect(d.anciennete.j15_30).toBe(1);
    expect(d.anciennete.j30p).toBe(1);
    expect(d.anciennete.plus_ancienne.reference).toBe('ANM-OLD');
    expect(d.anciennete.par_priorite.normale.total).toBe(6);
  });
});

describe('V5.5 — flux, moyenne mobile et résorption', () => {
  const S = '2026-08-09';
  const E = '2026-10-31';
  let db;
  let refs;

  beforeAll(() => {
    const ctx = setup();
    db = ctx.db;
    refs = ctx.refs;
    const weeks = ['2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'];
    // Backlog traité : 15 par semaine, signalé avant la fenêtre.
    for (const [index, week] of weeks.entries()) {
      for (let i = 0; i < 15; i += 1) {
        ctx.insert({
          date_signalement: '2026-01-01',
          date_traitement: addDays(week, 1),
          statut: 'traite',
          verification: 'confirmee',
          epic_id: refs.epicId,
          agent_id: refs.agentId,
          reference: `ANM-TR-${index}-${i}`,
        });
      }
    }
    // Reçues : 10 par semaine sur les 4 premières, 20 sur la dernière.
    for (const [index, week] of weeks.entries()) {
      const count = index === weeks.length - 1 ? 20 : 10;
      for (let i = 0; i < count; i += 1) {
        ctx.insert({ date_signalement: week, reference: `ANM-RE-${index}-${i}` });
      }
    }
  });

  it('calcule la moyenne mobile 4 semaines et une résorption positive', () => {
    const d = detailStats(db, { from: S, to: E });
    const last = d.tendance.serie[d.tendance.serie.length - 1];
    expect(last.recues).toBe(20);
    expect(last.mm4_recues).toBe(12.5);
    expect(d.tendance.moyenne_4s).toEqual({ recues: 12.5, traitees: 15, net: 2.5 });
    expect(d.tendance.resorption).toMatchObject({ possible: true, net_hebdo: 2.5, semaines: 24 });
    expect(d.tendance.stock_actuel).toBe(60);
    expect(d.tendance.tendance_stock).toBe('stable');
  });

  it('déclenche le fait « reçues en hausse » à +100 %', () => {
    const d = detailStats(db, { from: S, to: E });
    const fact = d.faits.find((f) => f.code === 'RECUES_EN_HAUSSE');
    expect(fact).toBeTruthy();
    expect(fact.gravite).toBe('attention');
  });

  it('passe l’objectif en retard sous 75 %', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.objectif.cible).toBe(80);
    expect(d.objectif.taux_pct).toBe(0);
    expect(d.objectif.statut).toBe('en_retard');
  });
});

describe('V5.5 — points noirs, qualité et faits marquants', () => {
  const S = '2026-09-01';
  const E = '2026-09-07';
  let db;
  let refs;

  beforeAll(() => {
    const ctx = setup();
    db = ctx.db;
    refs = ctx.refs;
    const first = ctx.insert({
      date_signalement: '2026-09-02', gps_lat: 36.7001, gps_lng: 3.1001,
      gps_verifiee: 1, verification: 'confirmee', agent_id: refs.agentId,
      priorite: 'urgente', date_verification: '2026-09-02',
    });
    const second = ctx.insert({
      date_signalement: '2026-09-03', gps_lat: 36.7002, gps_lng: 3.1002,
      gps_verifiee: 1, verification: 'confirmee', agent_id: refs.agentId,
      priorite: 'urgente', date_verification: '2026-09-03',
    });
    const third = ctx.insert({
      date_signalement: '2026-09-04', gps_lat: 36.7001, gps_lng: 3.1001,
      lie_a_id: first, verification: 'confirmee', agent_id: refs.agentId,
      priorite: 'urgente', date_verification: '2026-09-04',
    });
    const photo = db.prepare(`INSERT INTO pieces_jointes(anomalie_id, chemin, nom_original, mime, taille)
      VALUES (?, ?, 'p.jpg', 'image/jpeg', 10)`);
    for (const id of [first, second, third]) photo.run(id, `uploads/${id}.jpg`);
    // Fiche incomplète : sans GPS, sans agent, sans photo.
    ctx.insert({ date_signalement: '2026-09-05' });
    // Ancienne fiche « à vérifier », hors cohorte, pour la règle de vérification en retard.
    ctx.insert({ date_signalement: '2026-08-01' });
  });

  it('regroupe les points noirs sur ~100 m en incluant les liens', () => {
    const d = detailStats(db, { from: S, to: E });
    const top = d.recurrents.top[0];
    expect(top.cellule).toBe('36.700,3.100');
    expect(top.total).toBe(3);
    expect(top.liees).toBe(1);
    expect(top.ouvertes).toBe(3);
    expect(d.recurrents.nouveaux.length).toBe(1);
    expect(d.faits.some((f) => f.code === 'NOUVEAU_POINT_NOIR')).toBe(true);
  });

  it('mesure la qualité des données', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.qualite.total).toBe(4);
    expect(d.qualite.geolocalisees).toBe(3);
    expect(d.qualite.pct_geolocalisees).toBe(75);
    expect(d.qualite.confirmees_sur_place).toBe(2);
    expect(d.qualite.pct_confirmees_sur_place).toBe(66.7);
    expect(d.qualite.a_completer.length).toBe(1);
    expect(d.qualite.a_completer[0].sans_gps).toBe(1);
    expect(d.faits.some((f) => f.code === 'GEOLOCALISATION_FAIBLE')).toBe(true);
  });

  it('signale les urgentes hors SLA et les vérifications en retard', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.faits.some((f) => f.code === 'URGENTES_HORS_SLA')).toBe(true);
    expect(d.faits.some((f) => f.code === 'VERIFICATION_EN_RETARD')).toBe(true);
    for (const fact of d.faits) {
      expect(fact.fr).toBeTruthy();
      expect(fact.ar).toBeTruthy();
      expect(['info', 'attention', 'critique']).toContain(fact.gravite);
    }
  });

  it('concentre une catégorie à plus de 25 % des reçues', () => {
    const d = detailStats(db, { from: S, to: E });
    expect(d.faits.some((f) => f.code === 'CONCENTRATION_CATEGORIE')).toBe(true);
  });

  it('vérifie la cohérence des ventilations avec les KPI', () => {
    const d = detailStats(db, { from: S, to: E });
    const total = d.ventilations.domaine.reduce((sum, row) => sum + row.total, 0);
    expect(total).toBe(d.kpis.total);
    for (const row of d.ventilations.plateforme) {
      expect(row.pct_non_traite + row.pct_en_cours + row.pct_traite).toBeCloseTo(100, 1);
    }
  });
});
