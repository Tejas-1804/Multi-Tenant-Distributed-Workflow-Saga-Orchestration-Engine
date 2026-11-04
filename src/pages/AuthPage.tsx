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
  Zap,
} from 'lucide-react';
import { useAuth, DEMO_PERSONAS } from '../context/AuthContext.tsx';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'register' }) => {
  const { login, register, switchPersona } = useAuth();
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
  const [regPlan, setRegPlan] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('ENTERPRISE');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      setErrorMsg(err.response?.data?.error || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      await register(regName.trim(), regEmail.trim(), regPassword, regOrgName.trim() || 'Dharma', regPlan);
      setSuccessMsg('Workspace successfully provisioned! Logging into NexusFlow...');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1220] via-[#0F172A] to-[#172033] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          NexusFlow
        </h1>
        <p className="text-xs text-blue-400 font-mono uppercase tracking-widest">
          Distributed Enterprise DAG Engine
        </p>
      </div>

      {/* Main Card Container */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4 z-10">
        <div className="bg-[#172235] border border-[#1E2D4A] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-[#1E2D4A] text-sm font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 text-center transition-all cursor-pointer ${
                mode === 'register'
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account & Workspace
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-3 text-center transition-all cursor-pointer ${
                mode === 'login'
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* REGISTER FORM (Start from here as requested) */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Tejas Reddy"
                    className="w-full px-3 py-2 bg-[#0B1220] border border-[#1E2D4A] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tenant / Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regOrgName}
                    onChange={e => setRegOrgName(e.target.value)}
                    placeholder="Dharma"
                    className="w-full px-3 py-2 bg-[#0B1220] border border-[#1E2D4A] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="tejasreddy1808@gmail.com"
                  className="w-full px-3 py-2 bg-[#0B1220] border border-[#1E2D4A] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 bg-[#0B1220] border border-[#1E2D4A] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Organization Plan
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['FREE', 'PRO', 'ENTERPRISE'] as const).map(tier => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setRegPlan(tier)}
                      className={`p-2 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                        regPlan === tier
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-[#0B1220] border-[#1E2D4A] text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#2563eb] hover:bg-blue-600 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-900/40 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>{loading ? 'Creating Tenant...' : 'Provision Organization Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="tejasreddy1808@gmail.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#0B1220] border border-[#1E2D4A] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-10 py-2 bg-[#0B1220] border border-[#1E2D4A] rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#2563eb] hover:bg-blue-600 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-900/40 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to NexusFlow'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Quick Demo Personas with TR Tejas Reddy prominently displayed */}
          <div className="pt-4 border-t border-[#1E2D4A]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Instant 1-Click Tenant Admins:</span>
              <span className="text-blue-400 font-mono text-[10px]">Test Environment</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {DEMO_PERSONAS.slice(0, 4).map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => switchPersona(p.key)}
                  className="p-2.5 rounded-lg border border-[#1E2D4A] bg-[#0B1220] hover:bg-slate-800 hover:border-blue-500 text-left transition-all cursor-pointer group"
                >
                  <div className="font-bold text-white group-hover:text-blue-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 text-[9px] font-bold flex items-center justify-center font-mono">
                      {p.initials}
                    </span>
                    <span>{p.label.split(' ')[0]}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 ml-6">
                    {p.org}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
