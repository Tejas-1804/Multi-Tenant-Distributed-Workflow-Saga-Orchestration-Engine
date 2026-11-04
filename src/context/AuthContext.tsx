import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api.ts';
import { User, Tenant, UserRole } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  targetTenantId: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, organizationName?: string) => Promise<void>;
  logout: () => void;
  setTargetTenant: (tenantId: string | null) => void;
  switchPersona: (personaKey: 'SUPER_ADMIN' | 'ACME_ADMIN' | 'ACME_OPERATOR' | 'CYBER_ADMIN') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_PERSONAS = [
  {
    key: 'ACME_ADMIN' as const,
    label: 'Sarah Connor (Tenant Admin)',
    role: 'TENANT_ADMIN' as UserRole,
    org: 'Acme Logistics Global',
    email: 'admin@acme.com',
    password: 'AcmeAdmin123!',
  },
  {
    key: 'ACME_OPERATOR' as const,
    label: 'Kyle Reese (Operator)',
    role: 'TENANT_USER' as UserRole,
    org: 'Acme Logistics Global',
    email: 'operator@acme.com',
    password: 'Operator123!',
  },
  {
    key: 'CYBER_ADMIN' as const,
    label: 'Miles Dyson (Tenant Admin)',
    role: 'TENANT_ADMIN' as UserRole,
    org: 'Cyberdyne Systems Corp',
    email: 'admin@cyberdyne.com',
    password: 'Cyber123!',
  },
  {
    key: 'SUPER_ADMIN' as const,
    label: 'System Admin (Global)',
    role: 'SUPER_ADMIN' as UserRole,
    org: 'Multi-Tenant Platform',
    email: 'superadmin@orchestration.engine',
    password: 'Admin123!',
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [targetTenantId, setTargetTenantId] = useState<string | null>(localStorage.getItem('targetTenantId'));
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setTenant(res.data.tenant);
    } catch (err) {
      console.warn('Failed to fetch user with existing token, signing in with demo account...');
      // Fallback: auto-login as demo Acme Admin
      await quickLogin('admin@acme.com', 'AcmeAdmin123!');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (email: string, pass: string) => {
    try {
      const res = await api.post('/auth/login', { email, password: pass });
      const newToken = res.data.token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(res.data.user);
      const meRes = await api.get('/auth/me');
      setTenant(meRes.data.tenant);
    } catch (err) {
      console.error('Demo login error:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      quickLogin('admin@acme.com', 'AcmeAdmin123!').finally(() => setIsLoading(false));
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.post('/auth/login', { email, password: pass });
    const newToken = res.data.token;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(res.data.user);
    const meRes = await api.get('/auth/me');
    setTenant(meRes.data.tenant);
  };

  const register = async (name: string, email: string, pass: string, orgName?: string) => {
    const res = await api.post('/auth/register', { name, email, password: pass, organizationName: orgName });
    const newToken = res.data.token;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(res.data.user);
    const meRes = await api.get('/auth/me');
    setTenant(meRes.data.tenant);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('targetTenantId');
    setToken(null);
    setUser(null);
    setTenant(null);
    setTargetTenantId(null);
  };

  const setTargetTenant = (id: string | null) => {
    if (id) {
      localStorage.setItem('targetTenantId', id);
    } else {
      localStorage.removeItem('targetTenantId');
    }
    setTargetTenantId(id);
    // Reload state for target tenant
    fetchCurrentUser();
  };

  const switchPersona = async (personaKey: 'SUPER_ADMIN' | 'ACME_ADMIN' | 'ACME_OPERATOR' | 'CYBER_ADMIN') => {
    const persona = DEMO_PERSONAS.find(p => p.key === personaKey);
    if (!persona) return;
    setIsLoading(true);
    try {
      await login(persona.email, persona.password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        targetTenantId,
        isLoading,
        login,
        register,
        logout,
        setTargetTenant,
        switchPersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
