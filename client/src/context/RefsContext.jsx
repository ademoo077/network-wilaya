import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const RefsContext = createContext(null);
const emptyRefs = { domaines: [], dairas: [], epics: [], agents: [], parametres: {}, taxonomie: {} };

export function RefsProvider({ children }) {
  const { user } = useAuth();
  const [refs, setRefs] = useState(emptyRefs);
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!user) { setRefs(emptyRefs); setSetup(null); return null; }
    setLoading(true);
    try {
      const [bootstrap, status] = await Promise.all([api('/ref/bootstrap'), api('/setup/status')]);
      setRefs(bootstrap);
      setSetup(status);
      return bootstrap;
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => { reload().catch(() => setLoading(false)); }, [reload]);
  const value = useMemo(() => ({
    refs, setup, loading, reload,
    types: refs.domaines.flatMap((domain) => domain.types || []),
    communes: refs.dairas.flatMap((daira) => daira.communes || []),
  }), [refs, setup, loading, reload]);
  return <RefsContext.Provider value={value}>{children}</RefsContext.Provider>;
}

export function useRefs() {
  const value = useContext(RefsContext);
  if (!value) throw new Error('RefsProvider missing');
  return value;
}
