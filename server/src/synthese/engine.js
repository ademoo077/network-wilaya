/**
 * Moteur de requête V8 (§ 5). Compile une spécification validée en SQL
 * paramétré, agrège par dimensions, calcule les mesures non additives par
 * requêtes dédiées, compare deux périodes et met en cache par `data_version`.
 *
 * Aucune valeur cliente n’est concaténée : seuls les `id` du catalogue
 * choisissent des expressions fixes.
 */
import {
  CATALOGUE, addDays, eachDay, eachWeek, escapeLike, findDimension, formatDateShort,
  localeFor, monthStart, normalize, parseDateUtc, percent, splitPercent, todayAlgiers,
  toDateString, validerRequete, weekStart,
} from '@anm/shared';
import { getParams } from '../services/settings.js';
import {
  DELAY, DELAY_INTERVENTION, DELAY_VERIFICATION, DIMENSION_FIELDS, FILTER_FIELDS,
  GPS_PRESENT, HAS_ATTACHMENT, SLA_TARGET, SOURCE_SAISIE, statusAt,
} from './fields.js';

const MAX_CACHE = 200;
const cache = new Map();

const TIME_COLUMNS = {
  signalement: 'a.date_signalement',
  traitement: 'a.date_traitement',
  date_verification: 'a.date_verification',
  intervention: 'a.date_intervention',
  publication: 'a.date_publication',
};

const PARTITION_IDS = ['cohorte_pct_non_traitees', 'cohorte_pct_en_cours', 'cohorte_pct_traitees'];

const SIMPLE_SQL = {
  recues: 'COUNT(*)',
  traitees_periode: 'COUNT(*)',
  cohorte_non_traitees: "SUM(CASE WHEN {{statusAt}} = 'non_traite' THEN 1 ELSE 0 END)",
  cohorte_en_cours: "SUM(CASE WHEN {{statusAt}} = 'en_cours' THEN 1 ELSE 0 END)",
  cohorte_traitees: "SUM(CASE WHEN {{statusAt}} = 'traite' THEN 1 ELSE 0 END)",
  taux_traitement: {
    num: "SUM(CASE WHEN {{statusAt}} = 'traite' THEN 1 ELSE 0 END)",
    den: 'COUNT(*)',
  },
  stock_fin: "SUM(CASE WHEN {{statusAt}} <> 'traite' THEN 1 ELSE 0 END)",
  stock_debut: "SUM(CASE WHEN a.date_signalement <= @D0 AND {{statusAt0}} <> 'traite' THEN 1 ELSE 0 END)",
  taux_traitement_cumule: {
    num: 'SUM(CASE WHEN a.date_traitement <= @D THEN 1 ELSE 0 END)',
    den: 'SUM(CASE WHEN a.date_signalement <= @D THEN 1 ELSE 0 END)',
  },
  delai_moyen: 'AVG({{delay}})',
  delai_min: 'MIN({{delay}})',
  delai_max: 'MAX({{delay}})',
  delai_verification_moyen: 'AVG({{delayVerification}})',
  delai_intervention_moyen: 'AVG({{delayIntervention}})',
  taux_sla: {
    num: 'SUM(CASE WHEN {{delay}} <= {{slaTarget}} THEN 1 ELSE 0 END)',
    den: 'COUNT(*)',
  },
  nb_hors_sla: 'SUM(CASE WHEN {{delay}} > {{slaTarget}} THEN 1 ELSE 0 END)',
  age_moyen_stock: "AVG(CASE WHEN {{statusAt}} <> 'traite' THEN julianday(@D) - julianday(a.date_signalement) END)",
  age_max_stock: "MAX(CASE WHEN {{statusAt}} <> 'traite' THEN julianday(@D) - julianday(a.date_signalement) END)",
  en_retard: "SUM(CASE WHEN {{statusAt}} <> 'traite' AND a.date_signalement < @cutoff THEN 1 ELSE 0 END)",
  urgentes_ouvertes: "SUM(CASE WHEN {{statusAt}} <> 'traite' AND a.priorite = 'urgente' THEN 1 ELSE 0 END)",
  taux_confirmation: {
    num: "SUM(CASE WHEN a.verification = 'confirmee' THEN 1 ELSE 0 END)",
    den: "SUM(CASE WHEN a.verification IN ('confirmee','infirmee') THEN 1 ELSE 0 END)",
  },
  taux_infirmation: {
    num: "SUM(CASE WHEN a.verification = 'infirmee' THEN 1 ELSE 0 END)",
    den: "SUM(CASE WHEN a.verification IN ('confirmee','infirmee') THEN 1 ELSE 0 END)",
  },
  taux_geolocalisation: {
    num: 'SUM(CASE WHEN {{gpsPresent}} THEN 1 ELSE 0 END)',
    den: 'COUNT(*)',
  },
  taux_gps_confirme: {
    num: 'SUM(CASE WHEN a.gps_verifiee = 1 THEN 1 ELSE 0 END)',
    den: 'COUNT(*)',
  },
  nb_liens_distincts: 'COUNT(DISTINCT a.lien_normalise)',
  nb_communes_touchees: 'COUNT(DISTINCT a.commune_id)',
  nb_dairas_touchees: 'COUNT(DISTINCT a.daira_id)',
  nb_recurrents: 'SUM(CASE WHEN a.lie_a_id IS NOT NULL THEN 1 ELSE 0 END)',
  indice_recurrence: {
    num: 'SUM(CASE WHEN a.lie_a_id IS NOT NULL THEN 1 ELSE 0 END)',
    den: 'COUNT(*)',
  },
  // V12 — affectation des agents et photos avant/après.
  non_affectees: "SUM(CASE WHEN {{statusAt}} <> 'traite' AND a.agent_id IS NULL THEN 1 ELSE 0 END)",
  delai_prise_en_charge: 'AVG(CASE WHEN a.agent_affecte_le IS NOT NULL THEN julianday(a.agent_affecte_le) - julianday(a.date_signalement) END)',
  charge_agent: "ROUND(1.0 * SUM(CASE WHEN {{statusAt}} <> 'traite' AND a.agent_id IS NOT NULL THEN 1 ELSE 0 END) / NULLIF((SELECT COUNT(*) FROM agents WHERE actif = 1), 0))",
  taux_traitement_par_agent: {
    num: 'SUM(CASE WHEN a.agent_id IS NOT NULL THEN 1 ELSE 0 END)',
    den: 'COUNT(*)',
  },
  taux_photo_avant: {
    num: "SUM(CASE WHEN EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id AND p.role = 'avant') THEN 1 ELSE 0 END)",
    den: 'COUNT(*)',
  },
  taux_photo_apres: {
    num: "SUM(CASE WHEN EXISTS (SELECT 1 FROM pieces_jointes p WHERE p.anomalie_id = a.id AND p.role = 'apres') THEN 1 ELSE 0 END)",
    den: 'COUNT(*)',
  },
};

const RANKED_SQL = {
  delai_median: 'AVG(CASE WHEN rn IN (CAST((n+1)/2 AS INTEGER), CAST((n+2)/2 AS INTEGER)) THEN delay END)',
  delai_p90: 'MAX(CASE WHEN rn = CAST(0.9 * n + 0.999999 AS INTEGER) THEN delay END)',
};

const TOKENS = {
  '{{statusAt}}': statusAt('a', 'D'),
  '{{statusAt0}}': statusAt('a', 'D0'),
  '{{delay}}': DELAY,
  '{{delayVerification}}': DELAY_VERIFICATION,
  '{{delayIntervention}}': DELAY_INTERVENTION,
  '{{slaTarget}}': SLA_TARGET,
  '{{gpsPresent}}': `(${GPS_PRESENT})`,
  '{{hasAttachment}}': HAS_ATTACHMENT,
  '{{sourceSaisie}}': SOURCE_SAISIE,
};

function expand(sql) {
  let out = sql;
  for (const [token, value] of Object.entries(TOKENS)) out = out.split(token).join(value);
  return out;
}

function warningError(message, code = 'SYNTHESE_REQUETE_INVALIDE') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function boundedNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function resolvePeriod(periode = {}, today, wsd) {
  const mode = periode.mode || 'semaine';
  if (mode === 'plage' || mode === 'herite' && periode.debut && periode.fin) {
    const debut = periode.debut || addDays(today, -29);
    const fin = periode.fin || today;
    if (debut > fin) throw warningError('La date de début doit précéder la date de fin');
    return { debut, fin, mode };
  }
  if (mode === 'glissant') {
    const jours = Math.min(3660, Math.max(1, Number(periode.jours) || 30));
    return { debut: addDays(today, -(jours - 1)), fin: today, mode, jours };
  }
  if (mode === 'mois') {
    const ref = periode.debut || today;
    const debut = monthStart(ref);
    const fin = periode.fin || addDays(monthStart(addDays(debut, 32)), -1);
    return { debut, fin, mode };
  }
  const ref = periode.debut || today;
  const debut = weekStart(ref, wsd);
  const fin = periode.fin || addDays(debut, 6);
  return { debut, fin, mode: mode === 'herite' ? 'semaine' : mode };
}

function buildContext(db, spec, options = {}) {
  const settings = getParams(db);
  const wsd = Number(settings.week_start_day) || 0;
  const retardDays = boundedNumber(settings.delai_retard_jours, 7);
  const today = options.today || todayAlgiers();
  const period = options.periodOverride || resolvePeriod(spec.periode || {}, today, wsd);
  const D = period.fin;
  return {
    settings,
    wsd,
    retardDays,
    today,
    period,
    D,
    D0: addDays(period.debut, -1),
    cutoff: addDays(D, -retardDays),
    slaUrgente: boundedNumber(settings.sla_urgente_j, 2),
    slaHaute: boundedNumber(settings.sla_haute_j, 5),
    slaNormale: boundedNumber(settings.sla_normale_j, 10),
    statut_mode: spec.statut_mode || 'actuel',
    base_temps: spec.base_temps || 'signalement',
  };
}

function baseParams(ctx) {
  return {
    debut: ctx.period.debut,
    fin: ctx.period.fin,
    D: ctx.D,
    D0: ctx.D0,
    cutoff: ctx.cutoff,
    wsd: ctx.wsd,
    slaUrgente: ctx.slaUrgente,
    slaHaute: ctx.slaHaute,
    slaNormale: ctx.slaNormale,
  };
}

function timeExpr(dateExpr, granularite) {
  switch (granularite) {
    case 'jour': return `date(${dateExpr})`;
    case 'semaine': return `date(${dateExpr}, '-' || ((CAST(strftime('%w', ${dateExpr}) AS INTEGER) - @wsd + 7) % 7) || ' days')`;
    case 'mois': return `substr(${dateExpr}, 1, 7)`;
    case 'trimestre': return `(substr(${dateExpr},1,4) || '-T' || CAST((CAST(substr(${dateExpr},6,2) AS INTEGER) + 2) / 3 AS INTEGER))`;
    case 'annee': return `substr(${dateExpr},1,4)`;
    case 'jour_semaine': return `CAST(strftime('%w', ${dateExpr}) AS INTEGER)`;
    default: return `date(${dateExpr})`;
  }
}

function dimensionField(id, ctx) {
  if (id === 'statut') {
    return { key: ctx.statut_mode === 'fin_periode' ? statusAt('a', 'D') : 'a.statut', joins: [] };
  }
  if (id === 'statut_fin') return { key: statusAt('a', 'D'), joins: [] };
  return DIMENSION_FIELDS[id];
}

function filterField(id, ctx) {
  if (id === 'statut') {
    return { expr: ctx.statut_mode === 'fin_periode' ? statusAt('a', 'D') : 'a.statut', joins: [] };
  }
  return FILTER_FIELDS[id];
}

function compileDimensions(spec, ctx) {
  return (spec.dimensions || []).map((ref) => {
    const meta = findDimension(ref.champ);
    if (meta.kind === 'time') {
      const dateExpr = TIME_COLUMNS[meta.id];
      return {
        id: meta.id,
        kind: meta.kind,
        granularite: ref.granularite,
        key: timeExpr(dateExpr, ref.granularite),
        joins: [],
        labelFr: null,
        labelAr: null,
        valeurs: null,
      };
    }
    const field = dimensionField(meta.id, ctx);
    return {
      id: meta.id,
      kind: meta.kind,
      granularite: null,
      key: field.key,
      joins: field.joins || [],
      labelFr: field.labelFr || null,
      labelAr: field.labelAr || null,
      valeurs: meta.valeurs || null,
    };
  });
}

function compileFilters(filters, ctx, joins) {
  const conditions = [];
  const values = {};
  let index = 0;
  for (const filtre of filters) {
    const field = filterField(filtre.champ, ctx);
    if (!field) throw warningError(`Filtre inconnu : ${filtre.champ}`);
    for (const join of field.joins || []) joins.add(join);
    const param = `f${index}`;
    index += 1;
    const expr = field.expr;
    if (filtre.op === 'is_null') {
      conditions.push(`${expr} IS ${filtre.valeur ? '' : 'NOT '}NULL`);
    } else if (filtre.op === 'in' || filtre.op === 'not_in') {
      values[param] = JSON.stringify(filtre.valeur);
      conditions.push(filtre.op === 'in'
        ? `${expr} IN (SELECT value FROM json_each(@${param}))`
        : `(${expr} IS NULL OR ${expr} NOT IN (SELECT value FROM json_each(@${param})))`);
    } else if (filtre.op === 'between') {
      values[`${param}a`] = filtre.valeur[0];
      values[`${param}b`] = filtre.valeur[1];
      conditions.push(`${expr} BETWEEN @${param}a AND @${param}b`);
    } else if (filtre.op === 'contains') {
      values[param] = `%${escapeLike(normalize(filtre.valeur))}%`;
      conditions.push(`${expr} LIKE @${param} ESCAPE '\\'`);
    } else {
      const operator = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' }[filtre.op];
      let value = filtre.valeur;
      if (typeof value === 'boolean') value = value ? 1 : 0;
      values[param] = value;
      conditions.push(`${expr} ${operator} @${param}`);
    }
  }
  return { conditions, values };
}

function population(spec, group) {
  const where = [];
  if (!spec.inclure_supprimees) where.push('a.deleted_at IS NULL');
  const includeInfirmees = spec.inclure_infirmees === true || group?.includeInfirmees === true;
  if (!includeInfirmees) where.push("a.verification <> 'infirmee'");
  return where;
}

function temporalWhere(group) {
  switch (group.temporal) {
    case 'cohorte': return ['a.date_signalement BETWEEN @debut AND @fin'];
    case 'traitement': return ['a.date_traitement BETWEEN @debut AND @fin'];
    case 'verification': return ["a.verification <> 'a_verifier'", 'a.date_verification BETWEEN @debut AND @fin'];
    case 'intervention': return ['a.date_intervention BETWEEN @debut AND @fin'];
    case 'stock': return ['a.date_signalement <= @D'];
    default: return [];
  }
}

function dimensionSelects(dims, joins) {
  return dims.map((dimension, index) => {
    for (const join of dimension.joins || []) joins.add(join);
    const parts = [`${dimension.key} AS k${index}`];
    if (dimension.labelFr) parts.push(`${dimension.labelFr} AS lf${index}`);
    if (dimension.labelAr) parts.push(`${dimension.labelAr} AS la${index}`);
    return parts.join(', ');
  });
}

function buildSimpleQuery(spec, ctx, group, dims, filters, options = {}) {
  const joins = new Set();
  const selects = dimensionSelects(dims, joins);
  const measureSelects = [];
  for (const id of group.measures) {
    const definition = SIMPLE_SQL[id];
    if (!definition) throw warningError(`Mesure non compilable : ${id}`);
    if (typeof definition === 'string') {
      measureSelects.push(`${expand(definition)} AS ${id}`);
    } else {
      measureSelects.push(`${expand(definition.num)} AS __num_${id}`);
      measureSelects.push(`${expand(definition.den)} AS __den_${id}`);
    }
  }
  const where = [...population(spec, group), ...temporalWhere(group)];
  const compiled = compileFilters(filters, ctx, joins);
  where.push(...compiled.conditions);
  if (options.excludeKeys && options.excludeDimension) {
    for (const join of options.excludeDimension.joins || []) joins.add(join);
    where.push(`${options.excludeDimension.key} NOT IN (SELECT value FROM json_each(@excl))`);
  }
  const groupBy = dims.length ? `GROUP BY ${dims.map((_, index) => `k${index}`).join(', ')}` : '';
  const sql = `SELECT ${[...selects, ...measureSelects].join(', ')}
    FROM anomalies a ${[...joins].join(' ')}
    WHERE ${where.join(' AND ')} ${groupBy}`;
  return {
    sql,
    params: {
      ...baseParams(ctx),
      ...compiled.values,
      ...(options.excludeKeys ? { excl: JSON.stringify(options.excludeKeys) } : {}),
    },
  };
}

function buildRankedQuery(spec, ctx, group, dims, filters, options = {}) {
  const joins = new Set();
  const selects = dimensionSelects(dims, joins);
  const where = [...population(spec, group), ...temporalWhere(group)];
  const compiled = compileFilters(filters, ctx, joins);
  where.push(...compiled.conditions);
  if (options.excludeKeys && options.excludeDimension) {
    for (const join of options.excludeDimension.joins || []) joins.add(join);
    where.push(`${options.excludeDimension.key} NOT IN (SELECT value FROM json_each(@excl))`);
  }
  const keys = dims.map((_, index) => `k${index}`);
  const partition = keys.length ? `PARTITION BY ${keys.join(', ')}` : '';
  const baseSql = `SELECT ${[...selects, `${DELAY} AS delay`].join(', ')}
    FROM anomalies a ${[...joins].join(' ')}
    WHERE ${where.join(' AND ')}`;
  const rankedSelect = [...keys, 'delay', `COUNT(*) OVER (${partition}) AS n`, `ROW_NUMBER() OVER (${partition} ORDER BY delay) AS rn`].join(', ');
  const valueSelects = group.measures.map((id) => {
    const expression = RANKED_SQL[id];
    if (!expression) throw warningError(`Mesure de délai non compilable : ${id}`);
    return `${expression} AS ${id}`;
  });
  const groupBy = keys.length ? `GROUP BY ${keys.join(', ')}` : '';
  const sql = `WITH base AS (${baseSql}), ranked AS (SELECT ${rankedSelect} FROM base)
    SELECT ${[...keys, ...valueSelects].join(', ')} FROM ranked ${groupBy}`;
  return {
    sql,
    params: {
      ...baseParams(ctx),
      ...compiled.values,
      ...(options.excludeKeys ? { excl: JSON.stringify(options.excludeKeys) } : {}),
    },
  };
}

function classifyMeasures(spec) {
  const groups = new Map();
  const derived = [];
  const include = (id) => {
    const meta = CATALOGUE.mesures[id];
    if (!meta || meta.derivee) return;
    const mode = RANKED_SQL[id] ? 'ranked' : 'simple';
    const key = `${meta.temporal}:${mode}`;
    if (!groups.has(key)) {
      groups.set(key, {
        temporal: meta.temporal,
        mode,
        measures: [],
        includeInfirmees: meta.temporal === 'verification',
      });
    }
    const group = groups.get(key);
    if (!group.measures.includes(id)) group.measures.push(id);
  };
  for (const mesure of spec.mesures) {
    const meta = CATALOGUE.mesures[mesure.id];
    if (meta.derivee) {
      derived.push(mesure.id);
      if (meta.derivee === 'partition') for (const id of meta.partition) include(id);
      if (meta.derivee === 'difference') for (const id of meta.from) include(id);
    } else {
      include(mesure.id);
    }
  }
  if (groups.size === 0) include('recues');
  return { groups: [...groups.values()], derived };
}

function normalizeValue(value, meta) {
  if (value === null || value === undefined) return meta.format === 'entier' ? 0 : null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return meta.format === 'jours' ? Math.round(n * 10) / 10 : n;
}

function rowKey(row, count) {
  return Array.from({ length: count }, (_, index) => String(row[`k${index}`])).join('\u0001');
}

function ingest(store, rows, dims, group) {
  for (const row of rows) {
    const key = rowKey(row, dims.length);
    let entry = store.get(key);
    if (!entry) {
      entry = {
        keys: dims.map((_, index) => row[`k${index}`]),
        labels: dims.map((_, index) => ({ fr: row[`lf${index}`] ?? null, ar: row[`la${index}`] ?? null })),
        valeurs: {},
      };
      store.set(key, entry);
    }
    for (const id of group.measures) {
      const meta = CATALOGUE.mesures[id];
      if (row[`__num_${id}`] !== undefined) {
        entry.valeurs[id] = percent(row[`__num_${id}`], row[`__den_${id}`]);
      } else {
        entry.valeurs[id] = normalizeValue(row[id], meta);
      }
    }
  }
}

function applyDerived(entry, derived) {
  for (const id of derived) {
    const meta = CATALOGUE.mesures[id];
    if (meta.derivee === 'partition') {
      const counts = meta.partition.map((measureId) => entry.valeurs[measureId] ?? 0);
      const pcts = splitPercent(counts);
      PARTITION_IDS.forEach((partitionId, index) => { entry.valeurs[partitionId] = pcts[index]; });
    } else if (meta.derivee === 'difference') {
      const first = entry.valeurs[meta.from[0]] ?? 0;
      const second = entry.valeurs[meta.from[1]] ?? 0;
      entry.valeurs[id] = first - second;
    }
  }
}

function emptyValues(spec) {
  const values = {};
  for (const mesure of spec.mesures) {
    const meta = CATALOGUE.mesures[mesure.id];
    values[mesure.id] = meta.derivee ? null : (meta.format === 'entier' ? 0 : null);
  }
  return values;
}

/** Complète les mesures absentes d’un groupe (un groupe sans ligne vaut 0 ou null). */
function fillMissing(entry, spec) {
  for (const mesure of spec.mesures) {
    const meta = CATALOGUE.mesures[mesure.id];
    if (meta.derivee) continue;
    if (entry.valeurs[mesure.id] === undefined) {
      entry.valeurs[mesure.id] = meta.format === 'entier' ? 0 : null;
    }
  }
}

const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function bucketLabels(granularite, key) {
  if (key === null || key === undefined) return { fr: '—', ar: '—' };
  const raw = String(key);
  if (granularite === 'jour') return { fr: formatDateShort(raw, 'fr'), ar: formatDateShort(raw, 'ar') };
  if (granularite === 'semaine') {
    return { fr: `Semaine du ${formatDateShort(raw, 'fr')}`, ar: `أسبوع ${formatDateShort(raw, 'ar')}` };
  }
  if (granularite === 'mois' && /^\d{4}-\d{2}$/.test(raw)) {
    const date = new Date(Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)) - 1, 1));
    const label = (lang) => new Intl.DateTimeFormat(localeFor(lang), {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(date);
    return { fr: label('fr'), ar: label('ar') };
  }
  if (granularite === 'trimestre' && /^\d{4}-T\d$/.test(raw)) {
    const [year, quarter] = raw.split('-T');
    return { fr: `T${quarter} ${year}`, ar: `الربع ${quarter} ${year}` };
  }
  if (granularite === 'annee') return { fr: raw, ar: raw };
  if (granularite === 'jour_semaine') {
    const index = Number(raw);
    return { fr: JOURS_FR[index] || raw, ar: JOURS_AR[index] || raw };
  }
  return { fr: raw, ar: raw };
}

function dimensionLabels(dimension, key, labels) {
  if (dimension.kind === 'time') {
    const bucket = bucketLabels(dimension.granularite, key);
    return { fr: labels?.fr ?? bucket.fr, ar: labels?.ar ?? bucket.ar };
  }
  if (labels?.fr !== null && labels?.fr !== undefined) {
    return { fr: labels.fr, ar: labels.ar ?? labels.fr };
  }
  const found = (dimension.valeurs || []).find((value) => String(value.id) === String(key));
  if (found) return { fr: found.label_fr, ar: found.label_ar };
  return { fr: key === null || key === undefined ? '—' : String(key), ar: key === null || key === undefined ? '—' : String(key) };
}

function enumerateBuckets(granularite, debut, fin, wsd = 0) {
  if (granularite === 'jour') return eachDay(debut, fin);
  if (granularite === 'semaine') return eachWeek(debut, fin, wsd).map((week) => week.debut);
  if (granularite === 'mois') {
    const out = [];
    let current = monthStart(debut);
    let guard = 0;
    while (current <= fin && guard < 600) {
      out.push(current.slice(0, 7));
      current = monthStart(addDays(current, 32));
      guard += 1;
    }
    return out;
  }
  if (granularite === 'trimestre') {
    const out = [];
    let year = Number(debut.slice(0, 4));
    let quarter = Math.floor((Number(debut.slice(5, 7)) - 1) / 3) + 1;
    const endYear = Number(fin.slice(0, 4));
    const endQuarter = Math.floor((Number(fin.slice(5, 7)) - 1) / 3) + 1;
    while ((year < endYear || (year === endYear && quarter <= endQuarter)) && out.length < 200) {
      out.push(`${year}-T${quarter}`);
      quarter += 1;
      if (quarter > 3) { quarter = 1; year += 1; }
    }
    return out;
  }
  if (granularite === 'annee') {
    const out = [];
    for (let year = Number(debut.slice(0, 4)); year <= Number(fin.slice(0, 4)); year += 1) out.push(String(year));
    return out;
  }
  return [];
}

function fillTime(rows, dimensions, period, spec, derived, wsd) {
  if (dimensions.length !== 1 || dimensions[0].kind !== 'time' || dimensions[0].granularite === 'jour_semaine') return rows;
  const keys = enumerateBuckets(dimensions[0].granularite, period.debut, period.fin, wsd);
  const existing = new Map(rows.map((row) => [String(row.keys[0]), row]));
  const filled = keys.map((key) => {
    if (existing.has(String(key))) return existing.get(String(key));
    const entry = { keys: [key], labels: [{ fr: null, ar: null }], valeurs: emptyValues(spec) };
    applyDerived(entry, derived);
    return entry;
  });
  for (const row of rows) if (!keys.includes(String(row.keys[0]))) filled.push(row);
  return filled;
}

function sortValue(row, champ, dims) {
  if (Object.prototype.hasOwnProperty.call(row.valeurs, champ)) return row.valeurs[champ];
  const index = dims.findIndex((dimension) => dimension.id === String(champ).replace(/^t\./, ''));
  if (index >= 0) return row.keys[index];
  return null;
}

function isNumeric(value) {
  return value !== null && value !== '' && Number.isFinite(Number(value));
}

function compareRows(first, second, tri, dims) {
  for (const order of tri) {
    const a = sortValue(first, order.champ, dims);
    const b = sortValue(second, order.champ, dims);
    if (a === null || a === undefined) {
      if (b === null || b === undefined) continue;
      return 1;
    }
    if (b === null || b === undefined) return -1;
    let result;
    if (isNumeric(a) && isNumeric(b)) result = Number(a) - Number(b);
    else result = String(a).localeCompare(String(b), 'fr');
    if (order.dir === 'desc') result = -result;
    if (result !== 0) return result;
  }
  return 0;
}

function defaultSort(spec, dims) {
  if (dims.length === 1 && dims[0].kind === 'time') return [{ champ: dims[0].id, dir: 'asc' }];
  const first = spec.mesures.find((mesure) => !CATALOGUE.mesures[mesure.id].derivee);
  if (first) return [{ champ: first.id, dir: 'desc' }];
  if (dims.length) return [{ champ: dims[0].id, dir: 'asc' }];
  return [];
}

function applyPareto(rows, totals, spec) {
  const requested = spec.mesures.map((mesure) => mesure.id);
  if (!requested.some((id) => ['pct_du_total', 'rang', 'pct_cumule'].includes(id))) return;
  const base = spec.mesures.find((mesure) => {
    const meta = CATALOGUE.mesures[mesure.id];
    return !meta.derivee && (meta.format === 'entier' || meta.format === 'decimal');
  }) || { id: 'recues' };
  const baseId = base?.id;
  const total = baseId ? totals.valeurs[baseId] : null;
  let cumulative = 0;
  rows.filter((row) => !row.autre).forEach((row, index) => {
    const value = baseId ? row.valeurs[baseId] : null;
    const part = total && value !== null ? Math.round((value * 1000) / total) / 10 : null;
    row.valeurs.pct_du_total = part;
    row.valeurs.rang = index + 1;
    if (part !== null) {
      cumulative += part;
      row.valeurs.pct_cumule = Math.round(cumulative * 10) / 10;
    } else {
      row.valeurs.pct_cumule = null;
    }
  });
  if (totals.valeurs) {
    totals.valeurs.pct_du_total = total ? 100 : null;
    totals.valeurs.rang = null;
    totals.valeurs.pct_cumule = total ? 100 : null;
  }
}

function shiftYear(value, years) {
  const date = parseDateUtc(value);
  if (!date) return null;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return toDateString(date);
}

function comparisonPeriods(spec, ctx) {
  const mode = spec.comparaison;
  if (!mode || mode === 'aucune') return [];
  if (mode === 'periode_libre') {
    return [{ debut: spec.comparaison_debut, fin: spec.comparaison_fin, mode: 'plage' }];
  }
  const length = Math.round((parseDateUtc(ctx.D) - parseDateUtc(ctx.period.debut)) / 86400000) + 1;
  if (mode === 'meme_periode_n-1') {
    return [{
      debut: shiftYear(ctx.period.debut, -1),
      fin: shiftYear(ctx.period.fin, -1),
      mode: 'plage',
    }];
  }
  if (mode === 'moyenne_4') {
    return Array.from({ length: 4 }, (_, index) => {
      const fin = addDays(ctx.period.debut, -1 - index * length);
      return { debut: addDays(fin, -(length - 1)), fin, mode: 'plage' };
    });
  }
  return [{
    debut: addDays(ctx.period.debut, -length),
    fin: addDays(ctx.period.debut, -1),
    mode: 'plage',
  }];
}

function averageComparison(results, keyed) {
  const store = new Map();
  for (const result of results) {
    for (const row of result.lignes) {
      const key = keyed ? row.dimensions.map((dimension) => String(dimension.key)).join('\u0001') : '';
      let entry = store.get(key);
      if (!entry) {
        entry = {
          dimensions: row.dimensions,
          sommes: {},
          compte: {},
        };
        store.set(key, entry);
      }
      for (const [measureId, value] of Object.entries(row.valeurs)) {
        if (value === null || value === undefined) continue;
        entry.sommes[measureId] = (entry.sommes[measureId] || 0) + Number(value);
        entry.compte[measureId] = (entry.compte[measureId] || 0) + 1;
      }
    }
  }
  const lignes = [];
  for (const entry of store.values()) {
    const valeurs = {};
    for (const [measureId, sum] of Object.entries(entry.sommes)) {
      valeurs[measureId] = entry.compte[measureId] ? Math.round((sum / entry.compte[measureId]) * 10) / 10 : null;
    }
    lignes.push({ dimensions: entry.dimensions, valeurs });
  }
  const totalEntry = store.get('');
  const totaux = { valeurs: {} };
  if (totalEntry) {
    for (const [measureId, sum] of Object.entries(totalEntry.sommes)) {
      totaux.valeurs[measureId] = totalEntry.compte[measureId]
        ? Math.round((sum / totalEntry.compte[measureId]) * 10) / 10
        : null;
    }
  }
  return { lignes, totaux };
}

function variation(current, previous, format) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const absolute = Math.round((Number(current) - Number(previous)) * 10) / 10;
  const kind = format === 'pourcentage' ? 'points' : format === 'jours' ? 'jours' : 'percent';
  const pct = kind === 'points' || !previous
    ? null
    : Math.round(((Number(current) - Number(previous)) / Number(previous)) * 1000) / 10;
  return { abs: absolute, pct, kind };
}

function attachComparison(current, comparison, spec) {
  const comparisonRows = new Map(comparison.lignes.map((row) => [
    row.dimensions.map((dimension) => String(dimension.key)).join('\u0001'),
    row,
  ]));
  for (const row of current.lignes) {
    const key = row.dimensions.map((dimension) => String(dimension.key)).join('\u0001');
    const previous = comparisonRows.get(key);
    row.comparaison = {};
    row.variations = {};
    for (const mesure of spec.mesures) {
      const meta = CATALOGUE.mesures[mesure.id];
      const previousValue = previous?.valeurs?.[mesure.id] ?? (meta.additive ? 0 : null);
      row.comparaison[mesure.id] = previousValue;
      row.variations[mesure.id] = variation(row.valeurs[mesure.id], previousValue, mesure.format || meta.format);
    }
  }
  if (current.totaux) {
    current.totaux.comparaison = {};
    current.totaux.variations = {};
    for (const mesure of spec.mesures) {
      const meta = CATALOGUE.mesures[mesure.id];
      const previousValue = comparison.totaux?.valeurs?.[mesure.id] ?? (meta.additive ? 0 : null);
      current.totaux.comparaison[mesure.id] = previousValue;
      current.totaux.variations[mesure.id] = variation(current.totaux.valeurs[mesure.id], previousValue, mesure.format || meta.format);
    }
  }
}

function shapeDimension(dimension, entry, index) {
  const labels = dimensionLabels(dimension, entry.keys[index], entry.labels[index]);
  return {
    id: dimension.id,
    key: entry.keys[index],
    label_fr: labels.fr,
    label_ar: labels.ar,
  };
}

function shapeRow(entry, dimensions, spec) {
  const values = {};
  for (const mesure of spec.mesures) values[mesure.id] = entry.valeurs[mesure.id] ?? null;
  return {
    dimensions: dimensions.map((dimension, index) => shapeDimension(dimension, entry, index)),
    valeurs: values,
    ...(entry.autre ? { autre: true } : {}),
  };
}

function compute(db, spec, ctx) {
  const warnings = [];
  if (spec.inclure_supprimees) warnings.push('Les fiches supprimées sont incluses.');
  const dimensions = compileDimensions(spec, ctx);
  const filters = spec.filtres || [];
  const { groups, derived } = classifyMeasures(spec);
  const rowsStore = new Map();
  const totalsStore = new Map();
  const wantTotals = spec.totaux !== false;

  for (const group of groups) {
    const builder = group.mode === 'ranked' ? buildRankedQuery : buildSimpleQuery;
    const rowsQuery = builder(spec, ctx, group, dimensions, filters);
    ingest(rowsStore, db.prepare(rowsQuery.sql).all(rowsQuery.params), dimensions, group);
    if (wantTotals) {
      const totalsQuery = builder(spec, ctx, group, [], filters);
      ingest(totalsStore, db.prepare(totalsQuery.sql).all(totalsQuery.params), [], group);
    }
  }

  for (const entry of rowsStore.values()) fillMissing(entry, spec);
  for (const entry of totalsStore.values()) fillMissing(entry, spec);
  for (const entry of rowsStore.values()) applyDerived(entry, derived);
  for (const entry of totalsStore.values()) applyDerived(entry, derived);

  let rows = [...rowsStore.values()];
  rows = fillTime(rows, dimensions, ctx.period, spec, derived, ctx.wsd);

  const tri = spec.tri?.length ? spec.tri : defaultSort(spec, dimensions);
  rows.sort((first, second) => compareRows(first, second, tri, dimensions));

  const totalsEntry = totalsStore.get('') || { keys: [], labels: [], valeurs: {} };
  fillMissing(totalsEntry, spec);
  applyDerived(totalsEntry, derived);
  const totals = { valeurs: {} };
  for (const mesure of spec.mesures) totals.valeurs[mesure.id] = totalsEntry.valeurs[mesure.id] ?? null;
  applyPareto(rows, totals, spec);

  const limite = spec.limite ?? null;
  const regrouper = spec.regrouper_autres !== false;
  if (limite && rows.length > limite) {
    const displayed = rows.slice(0, limite);
    if (regrouper && dimensions.length === 1) {
      const excluded = displayed.map((row) => row.keys[0]);
      const otherStore = new Map();
      const dimension = dimensions[0];
      for (const group of groups) {
        const builder = group.mode === 'ranked' ? buildRankedQuery : buildSimpleQuery;
        const built = builder(spec, ctx, group, [], filters, { excludeKeys: excluded, excludeDimension: dimension });
        ingest(otherStore, db.prepare(built.sql).all(built.params), [], group);
      }
      for (const entry of otherStore.values()) {
        fillMissing(entry, spec);
        applyDerived(entry, derived);
        entry.keys = ['__autres__'];
        entry.labels = [{ fr: 'Autres', ar: 'أخرى' }];
        entry.autre = true;
        displayed.push(entry);
      }
    } else {
      warnings.push('Limite appliquée sans regroupement « Autres » : les lignes au-delà de la limite sont masquées.');
    }
    rows = displayed;
  }

  if (spec.comparaison === 'moyenne_4') {
    warnings.push('La comparaison « moyenne 4 » est la moyenne des quatre périodes précédentes équivalentes.');
  }

  const lignes = rows.map((entry) => shapeRow(entry, dimensions, spec));
  const colonnes = {
    dimensions: dimensions.map((dimension) => {
      const meta = findDimension(dimension.id);
      return {
        id: dimension.id,
        label_fr: meta.label_fr,
        label_ar: meta.label_ar,
        type: dimension.kind,
        granularite: dimension.granularite || null,
      };
    }),
    mesures: spec.mesures.map((mesure) => {
      const meta = CATALOGUE.mesures[mesure.id];
      return {
        id: mesure.id,
        label_fr: mesure.alias || meta.label_fr,
        label_ar: mesure.alias || meta.label_ar,
        format: mesure.format || meta.format,
      };
    }),
  };

  return {
    colonnes,
    lignes,
    totaux: wantTotals ? { valeurs: totals.valeurs } : null,
    meta: {
      base_temps: ctx.base_temps,
      statut_mode: ctx.statut_mode,
      periode: { ...ctx.period },
      filtres_resumes: filters,
      population: spec.inclure_infirmees
        ? 'Fiches non supprimées, infirmées incluses'
        : 'Fiches non supprimées, infirmées exclues',
      definitions: spec.mesures.map((mesure) => {
        const meta = CATALOGUE.mesures[mesure.id];
        return { id: mesure.id, label_fr: meta.label_fr, description_fr: meta.description_fr, description_ar: meta.description_ar };
      }),
      avertissements: warnings,
    },
  };
}

function dataVersion(db) {
  try {
    return db.prepare('SELECT version FROM data_version WHERE id = 1').get()?.version || 1;
  } catch {
    return 1;
  }
}

function stableKey(value) {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableKey(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function remember(key, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

/** Évalue une requête V8 ; lève une Error `SYNTHESE_*` si elle est refusée. */
export function evaluateSynthese(db, rawSpec, options = {}) {
  const spec = validerRequete(rawSpec, { allowDeleted: options.allowDeleted === true });
  const version = dataVersion(db);
  const params = getParams(db);
  const key = stableKey({
    spec,
    today: options.today || null,
    version,
    catalogue: CATALOGUE.version,
    week_start_day: params.week_start_day,
    retard: params.delai_retard_jours,
    sla: [params.sla_urgente_j, params.sla_haute_j, params.sla_normale_j],
  });
  if (cache.has(key)) {
    const hit = cache.get(key);
    return { ...hit, meta: { ...hit.meta, cache: true } };
  }
  const started = Date.now();
  const ctx = buildContext(db, spec, options);
  const result = compute(db, spec, ctx);
  const ms = Date.now() - started;

  if (spec.comparaison && spec.comparaison !== 'aucune') {
    const periods = comparisonPeriods(spec, ctx);
    const contextOptions = { today: options.today, periodOverride: null };
    if (spec.comparaison === 'moyenne_4') {
      const comparisons = periods.map((period) => compute(
        db,
        { ...spec, comparaison: 'aucune' },
        buildContext(db, spec, { ...contextOptions, periodOverride: period }),
      ));
      attachComparison(result, averageComparison(comparisons, true), spec);
      result.meta.comparaison = { mode: 'moyenne_4', periodes: periods };
    } else {
      const comparison = compute(
        db,
        { ...spec, comparaison: 'aucune' },
        buildContext(db, spec, { ...contextOptions, periodOverride: periods[0] }),
      );
      attachComparison(result, comparison, spec);
      result.meta.comparaison = { periode: periods[0] };
    }
  }

  result.meta.ms = ms;
  result.meta.cache = false;
  result.meta.data_version = version;
  result.meta.catalogue_version = CATALOGUE.version;
  remember(key, result);
  return result;
}

/** Vide le cache (tests ou après migration). */
export function clearSyntheseCache() {
  cache.clear();
}
