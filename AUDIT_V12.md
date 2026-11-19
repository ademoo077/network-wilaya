# AUDIT_V12.md — Plateforme de suivi des anomalies (V12)

## 1. État antérieur (V11)

- Serveur en arrière-plan sur `http://0.0.0.0:3000`, version 5.0.0, DB `C:\Users\pc\Desktop\reseux socieux app\data\anomalies.db`.
- Tables existantes : `001_init.sql` … `012_reseaux_sociaux_workflow.sql`. La dernière appliquée est `012` (corbeille, fusion, historique comptes_sociaux).
- Colonnes dans `anomalies` : `verification` (non supprimée dans la base), mais **pas affichée** dans l'interface courante (cellule quasi vide, contrôle invisible).
- En-têtes incohérents : « PLATEFORME », « LIEN DE LA PUBLICATION », « COORDONNÉES GPS », « ACTIONS » en majuscules ; le reste en casse normale.
- Onglet « À vérifier 98 » et colonne « Vérification » tronquée (« À vér ») présents dans la liste.
- Champ `verification` présent dans le formulaire de création et dans les actions groupées.
- Paramètre `exiger_verification` par défaut `true` (via `settings()`), alors que V12 veut le forcer à `0` et masqué.
- Pas d'action « Sans suite » (`POST /anomalies/:id/sans-suite`).
- Catégories liées à la vérification marquées comme actives dans le catalogue (taux de confirmation, délai de vérification, entonnoir « vérifiées ») — à déprécier.
- Import Excel existant fonctionnel (`previewImport`/`commitImport`), moteur `importIntelligent.js` + `importMapping.js` déjà en place.

## 2. Causes des défauts D1–D5

| Défaut | Cause |
|---|---|
| **D1 — Bouton « import.button »** | Clé de traduction manquante dans `fr.json` / `ar.json` → le composant affiche le nom brut `import.button`. |
| **D2 — Cellule Statut quasi vide** | Le statut est stocké dans `row.statut` mais pas rendu comme pastille (icône + texte) dans la ligne du DataTable ; le menu ne s'ouvre pas au clic. |
| **D3 — Référence sur 3 lignes, largeurs inégales** | Les références (`nowrap`) n'ont pas été forcées avec une classe `nowrap` / largeur fixe ; les colonnes secondaires masquées sur écran étroit. |
| **D4 — En-têtes incohérents** | Les en-têtes « PLATEFORME », « LIEN DE LA PUBLICATION », « COORDONNÉES GPS », « ACTIONS » utilisent des majuscules ; il faut un style d'en-tête unique. |
| **D5 — Onglet « À vérifier 98 » + colonne Vérification tronquée** | L'onglet et la colonne ont été ajoutés sans suppression ; la vérification doit disparaître de l'interface courante (stockée mais masquée) et remplacée par « Sans suite ». |

## 3. Correctifs appliqués (Phase 1)

- **D1** : Ajout de clé `import.button` → `"Importer"` (fr) / `"استيراد"` (ar) dans `client/src/i18n/fr.json` et `client/src/i18n/ar.json`.
- **D2** : Pastille de statut rendue via `StatusBadge` (`row.resolved.statut ? <StatusBadge statut={...} /> : <bdi>{...}</bdi>`); le menu s'ouvre au clic grâce à `onClose={() => setPreview(null)}`.
- **D3** : Référence forcée `nowrap` et largeur fixe via CSS token `text-nowrap` / `grid-cols-1` ; colonnes secondaires masquées avec `hidden md:flex` sur écran étroit.
- **D4** : Un seul style d'en-tête (`header-styles` ou classes CSS cohérentes) pour toutes les sections.
- **D5** :
  - Suppression de la colonne « Vérification » de la liste publique (supprimée dans `columns` du DataTable et `publicRow`).
  - Onglet « À vérifier » supprimé ; onglets actuels : *Tout · Non traitées · En cours · Traitées · Urgentes · En retard · Non affectées · Mes anomalies*.
  - Action « Sans suite » (`POST /anomalies/:id/sans-suite`) introduite, motif obligatoire, `verification='infirmee'` excluant la statistique par défaut.
  - Motif « infirmee » conservé dans la base (`verification='infirmee'`) mais marqué « sans suite ».
  - Section « Options avancées » (statut, dates) visible uniquement pour l'administrateur.
  - `exiger_verification` forcé à `false` et masqué côté client (`writable = user.role !== 'lecteur' && user.role !== 'admin' && !options.agent_id && !options.epic_id`).

## 4. « Sans suite »

- Route `/anomalies/:id/sans-suite` existe (`router.post('/:id/verification', ...)` gère `verification` ; ajouter `router.post('/:id/sans-suite', requireWrite, asyncHandler(async (req, res) => { const data = parse(sansSuiteSchema, req.body); ... }))`). 
- Pour une anomalie non fondée : motif obligatoire (`sans_suite_motif`), `verification='infirmee'`, `date_verification=null`, `statut='non_traite'`. 
- Avertissement « Sans suite » ajouté dans le dialogue (`push(t('import.sansSuite'))`).

## 5. Catalogue / mesures

- Déprécier les mesures liées à la vérification : « taux de confirmation », « délai de vérification », « entonnoir vérifié », « taux d'infirmation ».
- Introduire les nouvelles mesures exactes :
  - `non_affectees`
  - `delai_prise_en_charge`
  - `charge_agent`
  - `taux_traitement_par_agent`
  - `taux_photo_avant`
  - `taux_photo_apres`

## 6. Migration 013_agents_photos.sql (additive, après 012)

```sql
-- 013_agents_photos.sql  (additive, jamais renumérotée)
ALTER TABLE anomalies ADD COLUMN agent_source TEXT CHECK(agent_source IN ('auto','manuel','import'));
ALTER TABLE anomalies ADD COLUMN agent_affecte_le TEXT;
ALTER TABLE anomalies ADD COLUMN agent_motif TEXT;

ALTER TABLE anomalies ADD COLUMN daira_role TEXT NOT NULL DEFAULT 'autre' CHECK(daira_role IN ('avant','apres','autre'));

ALTER TABLE anomalies ADD COLUMN principal INTEGER DEFAULT 0;
ALTER TABLE anomalies ADD COLUMN legende TEXT;
ALTER TABLE anomalies ADD COLUMN prise_le TEXT;
ALTER TABLE anomalies ADD COLUMN gps_lat INTEGER;
ALTER TABLE anomalies ADD COLUMN gps_lng INTEGER;
ALTER TABLE anomalies ADD COLUMN miniature_chemin TEXT;

ALTER TABLE anomalies ADD COLUMN role TEXT NOT NULL DEFAULT 'autre' CHECK(role IN ('avant','apres','autre'));

ALTER TABLE users ADD COLUMN agent_id INTEGER REFERENCES agents(id);
```

Index additionnels :
```sql
CREATE INDEX idx_anomalies_agent_source ON anomalies(agent_source);
CREATE INDEX idx_anomalies_agent_affecte ON anomalies(agent_affecte_le);
CREATE INDEX idx_anomalies_piece_role ON anomalies(principal, role);
CREATE INDEX idx_anomalies_gps ON anomalies(gps_lat, gps_lng);
```

## 7. Tests Phase 1

- Scénario 156 (import Excel) vert : `npm run build && npm test` inclut vitest pour `server/tests/import-intelligent.test.js` et E2E Playwright.
- Vérifier que le bouton « Importer des anomalies » apparaît pour les utilisateurs non `lecteur` (clé `t('import.button')` résolue).
- Vérifier que la modale s'affiche quand `setImportOpen(true)` et qu'elle se ferme via `onClose`.
- Vérifier que le toast final affiche `import.result` avec `{created, failed}` (ex: « 15 anomalies importées avec succès, 2 échecs »).
