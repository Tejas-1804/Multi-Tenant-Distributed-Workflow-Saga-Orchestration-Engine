import React, { useState } from 'react';
import {
  Workflow,
  Lock,
  Mail,
  User,
  Building,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Shield,
  RotateCcw,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext.tsx';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regOrgName, setRegOrgName] = useState('');
  const [regPlan, setRegPlan] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('PRO');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const generatedSlug = regOrgName
    ? regOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : 'your-tenant-slug';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Please fill out all required fields.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await register(
        regName.trim(),
        regEmail.trim(),
        regPassword,
        regOrgName.trim() || undefined,
        regPlan
      );
      setSuccessMsg('Account created successfully! Redirecting...');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPersona = async (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setErrorMsg(null);
    setLoading(true);
    try {
      await login(email, pass);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500/20 selection:text-emerald-300 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-cyan-500/5 blur-[100px] pointer-events-none rounded-full" />

      {/* Top Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-950/60 mb-2">
          <Workflow className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">
          Distributed Saga Engine
        </h1>
        <p className="text-xs text-zinc-400 font-mono">
          MULTI-TENANT DAG WORKFLOW ORCHESTRATION & ROLLBACK PLATFORM
        </p>
      </div>

      {/* Main Card Container */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 z-10">
        <div className="bg-zinc-900/70 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-zinc-800 text-sm font-mono">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 text-center transition-all cursor-pointer font-semibold ${
                mode === 'login'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 text-center transition-all cursor-pointer font-semibold ${
                mode === 'register'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              CREATE WORKSPACE
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-mono flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="name@organization.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-mono text-zinc-300">Password</label>
                  <span className="text-[11px] font-mono text-zinc-500">Encrypted with bcrypt</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs font-mono flex items-center justify-center gap-2 shadow-sm shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* 1-Click Fast Login Shortcuts */}
              <div className="pt-5 border-t border-zinc-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="uppercase tracking-wider">Fast Test Personas (1-Click)</span>
                  <span className="text-emerald-400 font-semibold">PRE-SEEDED</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEMO_PERSONAS.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleQuickPersona(p.email, p.password)}
                      className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all text-left flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300">
                          {p.label.split(' ')[0]} {p.label.split(' ')[1]}
                        </span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {p.role}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                        {p.email}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1.5">Work Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="john@company.com"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                  Password (min 6 characters)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Organization / Tenant Specification */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 font-bold">
                  <Building className="w-3.5 h-3.5 text-emerald-400" />
                  <span>NEW TENANT REALM PROVISIONING</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Organization / Tenant Name
                  </label>
                  <input
                    type="text"
                    value={regOrgName}
                    onChange={e => setRegOrgName(e.target.value)}
                    placeholder="e.g. Apex Distributed Systems"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <div className="text-[10px] font-mono text-zinc-500 mt-1">
                    Tenant Slug Identifier: <code className="text-emerald-400">tenant_{generatedSlug}</code>
                  </div>
                </div>

                {/* Plan Selection */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1.5">
                    Select Tenant Tier Plan
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    {[
                      { id: 'FREE', label: 'FREE', rate: '100 req/m' },
                      { id: 'PRO', label: 'PRO', rate: '1,000 req/m' },
                      { id: 'ENTERPRISE', label: 'ENTERPRISE', rate: '5,000 req/m' },
                    ].map(plan => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setRegPlan(plan.id as any)}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          regPlan === plan.id
                            ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="font-bold text-[11px]">{plan.label}</div>
                        <div className="text-[10px] text-zinc-500">{plan.rate}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-zinc-400 font-mono leading-relaxed pt-1">
                  You will automatically be provisioned as <span className="text-emerald-400 font-bold">TENANT_ADMIN</span> with full DAG builder, execution, API key, and Saga management rights.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs font-mono flex items-center justify-center gap-2 shadow-sm shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Provisioning Tenant Workspace...' : 'Register & Launch Workspace'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* Footer Highlights */}
          <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-around text-[10px] font-mono text-zinc-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Multi-Tenant Isolated</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Saga LIFO Rollbacks</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3 text-purple-400" />
              <span>Worker Node Fleet</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
