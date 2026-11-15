import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { analyserTexte, evaluateCases, normalizeTerm } from '@anm/shared';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lexiconPath = path.join(root, 'seed', 'lexique_initial_veille.csv');
const fixturePath = path.join(root, 'tests', 'fixtures', 'veille-eval.json');
const rows = parse(fs.readFileSync(lexiconPath, 'utf8').replace(/^\uFEFF/, ''), {
  columns: true, skip_empty_lines: true, trim: true,
});
const lexicon = rows.map((row, index) => ({
  id: index + 1,
  terme: row.terme,
  terme_norm: normalizeTerm(row.terme, row.langue),
  langue: row.langue,
  role: row.role,
  groupe_id: row.groupe_fr && row.groupe_fr !== '*' ? row.groupe_fr : null,
  domaine_id: null,
  type_id: null,
  poids: Number(row.poids),
  actif: 1,
}));
const cases = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const report = evaluateCases(cases, (item) => {
  const result = analyserTexte(item.texte, lexicon, { seuils: { suggestion: 4, pertinent: 2 } });
  return result.suggestions[0]?.groupe_id || null;
});

console.log(`Jeu d'évaluation V7 : ${report.total} publications fictives`);
console.log(`Matrice : TP=${report.tp} FP=${report.fp} FN=${report.fn} TN=${report.tn}`);
console.log(`Précision : ${(report.precision * 100).toFixed(1)} % (objectif ≥ 70 %)`);
console.log(`Rappel    : ${(report.recall * 100).toFixed(1)} % (objectif ≥ 80 %)`);
console.log(`F1        : ${(report.f1 * 100).toFixed(1)} %`);
console.log('Matrice de confusion :');
for (const row of report.matrix) console.log(`  ${row.cell} : ${row.count}`);
const errors = report.details.filter((row) => !row.ok);
if (errors.length) {
  console.log(`Erreurs (${errors.length}) :`);
  for (const error of errors.slice(0, 20)) console.log(`  ${error.id} attendu=${error.actual || 'aucun'} prédit=${error.predicted || 'aucun'}`);
}
if (report.precision < 0.7 || report.recall < 0.8) {
  console.error('Objectifs V7 non atteints : précision ≥ 70 % et rappel ≥ 80 % sont requis.');
  process.exit(1);
}
