import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

/** Clé stable par URL : les pages et leurs aperçus partagent le cache et l'annulation. */
export function useApiQuery(path, options = {}) {
  const query = useQuery({ queryKey: ['api', path], queryFn: ({ signal }) => api(path, { signal }),
    placeholderData: keepPreviousData, ...options });
  return { ...query, loading: query.isPending, reload: query.refetch };
}
