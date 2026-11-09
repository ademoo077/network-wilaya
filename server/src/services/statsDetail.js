import { weekStart, weekEnd, todayAlgiers } from '@anm/shared';
import { getParams } from './settings.js';
import { overview } from './stats.js';
import { funnel, stockAge, trend, objectif } from './statsFlow.js';
import { delays, sla } from './statsDelays.js';
import { ventilation, weekday, heatmap } from './statsBreakdowns.js';
import { recurring, quality, faitsMarquants } from './statsQuality.js';

/**
 * Statistiques détaillées de la période [from, to] (défaut : semaine courante).
 * Les KPI reprennent les conventions V4 § 5.1 ; l'entonnoir, le stock et la SLA
 * utilisent l'état à la date E (§ 5.2). Voir DECISIONS.md pour les écarts assumés.
 */
export function detailStats(db, params = {}) {
  const settings = getParams(db);
  const wsd = Number(settings.week_start_day) || 0;
  const today = params.today || todayAlgiers();
  const all = params.all_periods === true || params.all_periods === '1';
  const E = all ? (params.to || today) : (params.to || weekEnd(today, wsd));
  const S = all ? (params.from || '2000-01-01') : (params.from || weekStart(E, wsd));
  const filters = { ...params, from: S, to: E };

  const ov = overview(db, filters);
  const kpis = {
    total: ov.cohorte.total,
    non_traite: ov.cohorte.non_traite,
    en_cours: ov.cohorte.en_cours,
    traite: ov.cohorte.traite,
    pct_non_traite: ov.cohorte.pct_non_traite,
    pct_en_cours: ov.cohorte.pct_en_cours,
    pct_traite: ov.cohorte.pct_traite,
    taux_traitement: ov.taux_traitement,
    delai_moyen_jours: ov.delai_moyen_jours,
    urgentes_ouvertes: ov.urgentes_ouvertes,
    en_retard: ov.en_retard,
    variations: ov.variations,
  };

  const entonnoir = funnel(db, params, S, E);
  const delais = delays(db, params, S, E, settings);
  const respect = sla(db, params, S, E, settings);
  const anciennete = stockAge(db, params, E);
  const tendance = trend(db, params, E, settings);
  const objectifData = objectif(db, params, S, E, settings);

  const ventilations = {};
  for (const by of ['plateforme', 'groupe', 'domaine', 'type', 'daira', 'commune', 'epic', 'agent']) {
    ventilations[by] = ventilation(db, params, S, E, by, settings);
  }
  const jours = weekday(db, params, S, E);
  const carte = heatmap(db, params, E, settings);
  const points = recurring(db, params, S, E);
  const qualite = quality(db, params, S, E);
  const faits = faitsMarquants(db, {
    params, settings, S, E, kpis,
    objectif: objectifData, trend: tendance, ventilations, delais, qualite, recurrents: points,
  });

  return {
    periode: { from: S, to: E, all, week_start_day: wsd, aujourd_hui: today },
    kpis,
    entonnoir,
    delais,
    sla: respect,
    anciennete,
    tendance,
    objectif: objectifData,
    ventilations,
    jours,
    carte,
    recurrents: points,
    qualite,
    faits,
  };
}
