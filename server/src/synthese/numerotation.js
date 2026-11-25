/** V19 — séquence annuelle officielle, atomique et jamais réutilisée. */
import { CHARTE_V19 } from '@anm/shared';

const ANNEE = /^\d{4}$/;

function motifValide(motif) {
  return typeof motif === 'string' && motif.length <= 80 && motif.includes('{SEQ}') && motif.includes('{AAAA}');
}

export function nextNumero(db, anneeBrut, motifBrut) {
  const annee = String(anneeBrut || new Date().getUTCFullYear());
  if (!ANNEE.test(annee)) throw new Error('Année invalide');
  const motif = motifValide(motifBrut) ? motifBrut : CHARTE_V19.motifReference;
  const writer = db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO synthese_numeros(annee, sequence, motif) VALUES (?, 0, ?)').run(annee, motif);
    db.prepare(`UPDATE synthese_numeros
      SET sequence = sequence + 1, motif = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE annee = ?`).run(motif, annee);
    return db.prepare('SELECT sequence, motif FROM synthese_numeros WHERE annee = ?').get(annee);
  });
  const row = writer();
  return {
    annee,
    sequence: row.sequence,
    motif: row.motif,
    reference: row.motif.replaceAll('{SEQ}', String(row.sequence).padStart(4, '0')).replaceAll('{AAAA}', annee),
  };
}
