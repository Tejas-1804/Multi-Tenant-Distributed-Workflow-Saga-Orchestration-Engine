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
  register: (name: string, email: string, password: string, organizationName?: string, plan?: 'FREE' | 'PRO' | 'ENTERPRISE') => Promise<void>;
  logout: () => void;
  setTargetTenant: (tenantId: string | null) => void;
  switchPersona: (personaKey: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_PERSONAS = [
  {
    key: 'TEJAS_ADMIN' as const,
    label: 'Tejas (Tenant Admin)',
    role: 'TENANT_ADMIN' as UserRole,
    org: 'Acme Logistics Global',
    email: 'tejas@acme.com',
    password: 'Tejas123!',
  },
  {
    key: 'AMAAN_ADMIN' as const,
    label: 'Amaan (Tenant Admin)',
    role: 'TENANT_ADMIN' as UserRole,
    org: 'Cyberdyne Systems Corp',
    email: 'amaan@cyberdyne.com',
    password: 'Amaan123!',
  },
  {
    key: 'PRIYANKA_ADMIN' as const,
    label: 'Priyanka (Tenant Admin)',
    role: 'TENANT_ADMIN' as UserRole,
    org: 'Quantum Dynamics Corp',
    email: 'priyanka@quantum.io',
    password: 'Priyanka123!',
  },
  {
    key: 'RINKLE_ADMIN' as const,
    label: 'Rinkle Sharma (Tenant Admin)',
    role: 'TENANT_ADMIN' as UserRole,
    org: 'Helios Cloud Systems',
    email: 'rinkle@helios.net',
    password: 'Rinkle123!',
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
      console.warn('Failed to fetch user with existing token, clearing session...');
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.post('/auth/login', { email, password: pass });
    const newToken = res.data.token;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(res.data.user);
    if (res.data.tenant) {
      setTenant(res.data.tenant);
    } else {
      const meRes = await api.get('/auth/me');
      setTenant(meRes.data.tenant);
    }
  };

  const register = async (
    name: string,
    email: string,
    pass: string,
    orgName?: string,
    plan?: 'FREE' | 'PRO' | 'ENTERPRISE'
  ) => {
    const res = await api.post('/auth/register', {
      name,
      email,
      password: pass,
      organizationName: orgName,
      plan: plan || 'PRO',
    });
    const newToken = res.data.token;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(res.data.user);
    if (res.data.tenant) {
      setTenant(res.data.tenant);
    } else {
      const meRes = await api.get('/auth/me');
      setTenant(meRes.data.tenant);
    }
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

  const switchPersona = async (personaKey: string) => {
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
