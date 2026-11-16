export const routeCases = [
  ['/', 'dashboard.hello'], ['/connexion', 'dashboard.hello'], ['/assistant', 'setup.title'],
  ['/anomalies', 'anomalies.title'], ['/anomalies/nouvelle', 'form.newTitle'],
  ['/anomalies/:id', 'reference'], ['/anomalies/:id/modifier', 'form.editTitle'],
  ['/carte', 'map.title'], ['/rapport', 'report.studio.title'], ['/profil', 'profile.title'],
  ['/laboratoire', 'lab.title'],
  ['/veille', 'veille.title'], ['/veille/tableau', 'veille.dashboard.title'], ['/veille/elements/:id', 'veille.detail.title'], ['/veille/reglages', 'veille.lexicon.title'], ['/veille/conformite', 'veille.compliance.title'],
  ...['referentiels', 'utilisateurs', 'parametres', 'sauvegardes', 'audit', 'import-export', 'corbeille', 'sante'].map((tab) => [`/admin/${tab}`, 'nav.admin']),
  ['/introuvable', 'notFound.title'],
];
