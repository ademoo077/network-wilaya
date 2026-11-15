import { z } from 'zod';

export const importConnector = {
  id: 'import',
  type: 'import',
  label: 'Import de fichiers (CSV, JSON, WhatsApp)',
  permissionNote: 'Import manuel : les fichiers sont analysés à l’envoi ; aucune collecte réseau.',
  schemaConfig: z.object({}).strict(),
  tester: async () => ({ ok: true }),
  collecter: async () => ({ elements: [], curseurSuivant: {}, quota: { posts: 0 } }),
  mapper: (raw) => raw,
};
