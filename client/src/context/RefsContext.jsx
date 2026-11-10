import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { emptyRefs } from '@anm/shared';
import { api, ApiError } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const RefsContext = createContext(null);
export function RefsProvider({ children }) {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['refs', user?.id], enabled: Boolean(user), retry: false,
    queryFn: async ({ signal }) => {
      const refs = await api('/ref/bootstrap', { signal });
      if (!refs) throw new ApiError(502, { error: { code: 'RESPONSE_SCHEMA' } });
      const setup = await api('/setup/status', { signal });
      if (!setup) throw new ApiError(502, { error: { code: 'RESPONSE_SCHEMA' } });
      return { refs, setup };
    } });
  const refs = query.data?.refs || emptyRefs;
  const value = useMemo(() => ({ refs, setup: query.data?.setup, error: query.error,
    loading: Boolean(user) && query.isPending, ready: Boolean(user && query.data),
    reload: async () => (await query.refetch()).data?.refs,
    types: (refs.domaines ?? []).flatMap((domain) => domain.types ?? []),
    communes: (refs.dairas ?? []).flatMap((daira) => daira.communes ?? []),
  // refetch is stable; the data dependencies control the context's identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [refs, query.data, query.error, query.isPending, user, query.refetch]);
  return <RefsContext.Provider value={value}>{children}</RefsContext.Provider>;
}
export function useRefs() {
  const value = useContext(RefsContext);
  if (!value) throw new Error('RefsProvider missing');
  return value;
}
