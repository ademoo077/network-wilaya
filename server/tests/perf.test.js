import { describe, it, expect, beforeAll } from 'vitest';
import { addDays, todayAlgiers } from '@anm/shared';
import { freshDatabase } from './helpers.js';
import { listAnomalies } from '../src/services/anomalyRead.js';
import { overview, groupStats } from '../src/services/stats.js';

const ROWS = 50000;
let db;
let refs;
let userId;

beforeAll(() => {
  const fresh = freshDatabase();
  db = fresh.db;
  refs = fresh.refs;
  userId = fresh.userIds.admin;
  const today = todayAlgiers();
  const insert = db.prepare(`INSERT INTO anomalies(
    reference, plateforme, lien_url, lien_normalise, date_signalement,
    domaine_id, type_id, daira_id, commune_id, verification, statut, priorite, search_norm, saisi_par
  ) VALUES (?, 'facebook', ?, ?, ?, ?, ?, ?, ?, 'a_verifier', 'non_traite', 'normale', ?, ?)`);
  const run = db.transaction(() => {
    for (let i = 1; i <= ROWS; i += 1) {
      const suffix = String(i).padStart(6, '0');
      insert.run(
        `PERF-2026-${suffix}`,
        `https://example.dz/perf/${suffix}`,
        `https://example.dz/perf/${suffix}`,
        addDays(today, -(i % 56)),
        refs.domaineId, refs.typeId, refs.dairaId, refs.communeId,
        `perf test ${suffix}`, userId,
      );
    }
  });
  run();
});

function measure(fn) {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

describe('Performance 50 000 lignes', () => {
  it('liste paginée sous 300 ms', () => {
    const { result, ms } = measure(() => listAnomalies(db, {
      page: 1, pageSize: 25, sort: 'date_signalement', dir: 'desc',
    }));
    expect(result.total).toBe(ROWS);
    expect(result.items).toHaveLength(25);
    expect(ms).toBeLessThan(300);
  });

  it('statistiques globales sous 300 ms', () => {
    const { result, ms } = measure(() => overview(db, { all_periods: true }));
    expect(result.cohorte.total).toBe(ROWS);
    expect(ms).toBeLessThan(300);
  });

  it('regroupement par daïra sous 300 ms', () => {
    const { result, ms } = measure(() => groupStats(db, 'daira', { all_periods: true }));
    expect(result.totals.total).toBe(ROWS);
    expect(ms).toBeLessThan(300);
  });
});
