import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrf } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const result = await api('/auth/me');
      setCsrf(result.csrf);
      setUser(result.user);
      return result.user;
    } catch (error) {
      if (error.status !== 401) throw error;
      setCsrf(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh().catch(() => setLoading(false)); }, [refresh]);
  useEffect(() => {
    const unauthorized = () => { setCsrf(null); setUser(null); };
    window.addEventListener('anm:unauthorized', unauthorized);
    return () => window.removeEventListener('anm:unauthorized', unauthorized);
  }, []);
  const login = useCallback(async (username, password) => {
    const result = await api('/auth/login', { method: 'POST', body: { username, password } });
    setCsrf(result.csrf);
    setUser(result.user);
    return result.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally { setCsrf(null); setUser(null); }
  }, []);
  const value = useMemo(() => ({ user, loading, login, logout, refresh, setUser }), [user, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}
