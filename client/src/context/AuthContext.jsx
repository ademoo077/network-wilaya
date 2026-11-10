import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, setCsrf } from '../api/client.js';
import { queryClient } from '../api/queryClient.js';

const AuthContext = createContext(null);
const key = ['auth', 'me'];
async function checkAuth({ signal }) {
  try {
    const result = await api('/auth/me', { signal });
    if (!result?.user || !result?.csrf) throw new ApiError(502, { error: { code: 'RESPONSE_SCHEMA' } });
    setCsrf(result.csrf);
    return result.user;
  } catch (error) {
    if (error.status !== 401) throw error;
    setCsrf(null);
    return null;
  }
}

export function AuthProvider({ children }) {
  const query = useQuery({ queryKey: key, queryFn: checkAuth, retry: false, staleTime: Infinity });
  const user = query.data || null;
  const setUser = useCallback((value) => queryClient.setQueryData(key, value), []);
  const refresh = useCallback(() => queryClient.fetchQuery({ queryKey: key, queryFn: checkAuth, staleTime: 0, retry: false }), []);
  const reset = useCallback(() => { queryClient.resetQueries({ queryKey: key }); }, []);
  useEffect(() => {
    const unauthorized = () => { setCsrf(null); setUser(null); queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' }); };
    window.addEventListener('anm:unauthorized', unauthorized);
    return () => window.removeEventListener('anm:unauthorized', unauthorized);
  }, [setUser]);
  const login = useCallback(async (username, password) => {
    const result = await api('/auth/login', { method: 'POST', body: { username, password } });
    setCsrf(result.csrf); setUser(result.user);
    return result.user;
  }, [setUser]);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setCsrf(null); setUser(null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
  }, [setUser]);
  const value = useMemo(() => ({ user, loading: query.isPending, error: query.error, login, logout, refresh, setUser, reset }),
    [user, query.isPending, query.error, login, logout, refresh, setUser, reset]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}
