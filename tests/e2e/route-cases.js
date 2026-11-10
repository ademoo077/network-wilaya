export const routeCases = [
  ['/', 'dashboard.hello'], ['/connexion', 'dashboard.hello'], ['/assistant', 'setup.title'],
  ['/anomalies', 'anomalies.title'], ['/anomalies/nouvelle', 'form.newTitle'],
  ['/anomalies/:id', 'reference'], ['/anomalies/:id/modifier', 'form.editTitle'],
  ['/carte', 'map.title'], ['/rapport', 'report.title'], ['/profil', 'profile.title'],
  ...['referentiels', 'utilisateurs', 'parametres', 'sauvegardes', 'audit', 'import-export', 'corbeille', 'sante'].map((tab) => [`/admin/${tab}`, 'nav.admin']),
  ['/introuvable', 'notFound.title'],
];
