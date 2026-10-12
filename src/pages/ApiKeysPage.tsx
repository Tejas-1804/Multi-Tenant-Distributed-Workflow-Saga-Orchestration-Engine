import React, { useState, useEffect } from 'react';
import { KeyRound, Plus, Trash2, RotateCw, Copy, Check, AlertTriangle, ShieldCheck, Code } from 'lucide-react';
import api from '../services/api.ts';
import { APIKey } from '../types/index.ts';

export const ApiKeysPage: React.FC = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [createdRawKeyData, setCreatedRawKeyData] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = async () => {
    try {
      const res = await api.get('/api-keys');
      setKeys(res.data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async () => {
    if (!keyName.trim()) return;
    try {
      const res = await api.post('/api-keys', {
        name: keyName,
        expiresInDays: parseInt(expiresInDays),
      });
      setCreatedRawKeyData(res.data);
      setKeyName('');
      await loadKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using it will immediately be rejected.')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      await loadKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleRotate = async (id: string) => {
    if (!confirm('Rotate this key? The existing key will be revoked immediately and a replacement key generated.')) return;
    try {
      const res = await api.post(`/api-keys/${id}/rotate`);
      setCreatedRawKeyData({
        ...res.data.newKey,
        warning: 'Key rotated! Save this replacement key now.',
      });
      await loadKeys();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Tenant API Keys
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Authenticate programmatic workflow execution and webhook triggers. Keys are hashed with SHA-256 before storage.
          </p>
        </div>

        <button
          onClick={() => {
            setCreatedRawKeyData(null);
            setNewKeyModal(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm shadow-emerald-950 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New API Key</span>
        </button>
      </div>

      {/* Raw Key Display Modal (Only Shown Once Upon Creation) */}
      {createdRawKeyData && (
        <div className="p-5 rounded-xl border border-amber-800/80 bg-amber-950/30 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>SAVE YOUR SECRET API KEY (ONLY VISIBLE ONCE)</span>
          </div>

          <p className="text-zinc-300 text-[11px] leading-relaxed">
            Please copy this key now. For security purposes, our database only stores a cryptographic SHA-256 hash. If you lose this key, you will have to rotate or generate a new one.
          </p>

          <div className="flex items-center gap-2 p-2.5 rounded bg-zinc-950 border border-zinc-800">
            <input
              type="text"
              readOnly
              value={createdRawKeyData.rawKey}
              className="flex-1 bg-transparent text-emerald-400 font-bold focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(createdRawKeyData.rawKey)}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-2 text-[10px] text-zinc-400">
            <span>Pass in HTTP requests using header: </span>
            <code className="text-zinc-200 font-bold">x-api-key: {createdRawKeyData.rawKey.substring(0, 15)}...</code>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
          Loading keys...
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden font-mono text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-500 uppercase text-[10px]">
                <th className="py-3 px-4">Key Name</th>
                <th className="py-3 px-4">Prefix</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Last Used</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-zinc-200">{k.name}</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-bold">{k.keyPrefix}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        k.status === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {k.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {k.status === 'ACTIVE' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRotate(k.id)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                          title="Rotate API Key"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevoke(k.id)}
                          className="p-1 rounded hover:bg-rose-950 text-rose-400 cursor-pointer"
                          title="Revoke API Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Code Snippet Card */}
      <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-zinc-200 font-bold">
          <Code className="w-4 h-4 text-cyan-400" />
          <span>Programmatic Ingestion Example (cURL)</span>
        </div>
        <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] overflow-x-auto">
{`curl -X POST https://your-domain.com/api/workflows/wf_order_processing/execute \\
  -H "x-api-key: wk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId": "ORD-9901", "amount": 250}'`}
        </pre>
      </div>

      {/* Create Modal */}
      {newKeyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-zinc-100">Create Tenant API Key</h3>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Key Description Name</label>
              <input
                type="text"
                value={keyName}
                onChange={e => setKeyName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline Key"
                className="w-full p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Expiration</label>
              <select
                value={expiresInDays}
                onChange={e => setExpiresInDays(e.target.value)}
                className="w-full p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
              >
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="0">Never expires</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setNewKeyModal(false)}
                className="px-3 py-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleCreate();
                  setNewKeyModal(false);
                }}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
