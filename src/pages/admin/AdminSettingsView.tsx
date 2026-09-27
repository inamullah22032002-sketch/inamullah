import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  CloudLightning,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Lock,
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminSettingsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'security' | 'infrastructure'>('security');
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // R2 Status State
  const [r2Status, setR2Status] = useState<any | null>(null);
  const [testingR2, setTestingR2] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchR2Status();
  }, []);

  const fetchR2Status = async () => {
    setTestingR2(true);
    try {
      const data = await api.admin.getR2Status();
      setR2Status(data);
    } catch (e: any) {
      setR2Status({
        configured: false,
        connection: 'failed',
        error: 'R2_CONNECTION_FAILED',
        message: e.message || 'Failed to check Cloudflare R2 status',
      });
    } finally {
      setTestingR2(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.admin.stats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await api.admin.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccess(res.message || 'Administrative password updated successfully in PostgreSQL.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update administrative password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">
            Admin Settings &amp; Governance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage administrative authentication, database persistence, and cloud storage drivers.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-white/10 self-start">
          <button
            onClick={() => setActiveSection('security')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'security'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Security &amp; Passkey
          </button>
          <button
            onClick={() => setActiveSection('infrastructure')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSection === 'infrastructure'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Infrastructure
          </button>
        </div>
      </div>

      {activeSection === 'security' && (
        <div className="space-y-6">
          {/* Change Password Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500"></div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-heading">
                  Change Administrative Password
                </h3>
                <p className="text-xs text-slate-400">
                  Update your database passkey. Once changed, the initial bootstrap password is no longer required.
                </p>
              </div>
            </div>

            {/* Success notification */}
            {passwordSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Error notification */}
            {passwordError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current Administrative Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-cyan-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Administrative Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-cyan-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm New Administrative Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-cyan-500/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-indigo-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {updatingPassword ? 'Saving to Database...' : 'Update Password'}
                  {!updatingPassword && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </form>
          </div>

          {/* Security Architecture Reference */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Bootstrap Authentication Security Architecture
            </h4>
            <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <p>
                <strong className="text-slate-200">First-Time Setup:</strong> When PostgreSQL is initialized, the system automatically bootstraps the first <code className="text-cyan-300">ADMIN</code> user if no administrators exist. Credentials can be customized using <code className="text-cyan-300">ADMIN_EMAIL</code> and <code className="text-cyan-300">ADMIN_INITIAL_PASSWORD</code>.
              </p>
              <p>
                <strong className="text-slate-200">Hashing:</strong> Passwords are encrypted server-side with bcrypt (cost factor 12) before being stored. Plain text credentials are never saved in the database or exposed to the client.
              </p>
              <p>
                <strong className="text-slate-200">Post-Bootstrap Lifecycle:</strong> Once an administrator account exists, all logins verify directly against PostgreSQL. The initial password variable is ignored, allowing you to update your credentials safely at any time.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'infrastructure' && (
        <div className="space-y-6">
          {/* Integration Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Database */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-heading">PostgreSQL Persistence</h3>
                </div>
                {stats?.system.isPostgresConnected ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Fallback Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {stats?.system.isPostgresConnected
                  ? 'External PostgreSQL database connected with full table migrations and relation indexing.'
                  : 'DATABASE_URL is not set. Resilient local relational store active so the platform is operational.'}
              </p>
            </div>

            {/* Cloudflare R2 */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudLightning className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white font-heading">Cloudflare R2 Storage</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchR2Status}
                    disabled={testingR2}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 font-medium transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingR2 ? 'animate-spin text-cyan-400' : ''}`} />
                    {testingR2 ? 'Testing...' : 'Test Connection'}
                  </button>
                  {r2Status?.connection === 'ok' ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> S3 Verified
                    </span>
                  ) : r2Status?.connection === 'failed' ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> {r2Status.error || 'Connection Failed'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> Missing Config
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {r2Status?.message ||
                  (stats?.system.isR2Configured
                    ? `Connected to bucket '${stats.system.bucketName || 'funclubsi'}'. Video uploads stream directly from the browser to Cloudflare R2 S3 endpoints without proxying.`
                    : 'Cloudflare R2 server environment variables must be configured on Netlify.')}
              </p>

              {/* Safe Environment Presence Checklist */}
              {r2Status && (
                <div className="pt-2 border-t border-white/5">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 block mb-2">
                    Server Environment Variable Check (Safe Audit)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: 'R2_ACCOUNT_ID', present: r2Status.accountIdPresent },
                      { key: 'R2_ACCESS_KEY_ID', present: r2Status.accessKeyPresent },
                      { key: 'R2_SECRET_ACCESS_KEY', present: r2Status.secretKeyPresent },
                      { key: 'R2_BUCKET_NAME', present: r2Status.bucketPresent },
                      { key: 'R2_ENDPOINT', present: r2Status.endpointPresent },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className={`p-2 rounded-lg border text-[11px] font-mono flex items-center justify-between ${
                          item.present
                            ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                            : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
                        }`}
                      >
                        <span className="truncate">{item.key}</span>
                        {item.present ? (
                          <span className="text-[10px] text-emerald-400 shrink-0 ml-1">✓ Set</span>
                        ) : (
                          <span className="text-[10px] text-rose-400 shrink-0 ml-1">✗ Missing</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {r2Status.missing && r2Status.missing.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex flex-col gap-1">
                      <span className="font-semibold text-amber-200">Required in Netlify Site Configuration:</span>
                      <p className="text-[11px] font-mono text-amber-400">
                        Please set: {r2Status.missing.join(', ')} under Site configuration &gt; Environment variables.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cloudflare R2 CORS Configuration */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <CloudLightning className="w-4 h-4 text-cyan-400" />
                Cloudflare R2 Bucket CORS Policy (Bucket: funclubsi)
              </h3>
              <span className="text-[11px] font-mono text-cyan-400">ExposeHeaders: ["ETag"] Required</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              To allow direct browser-to-R2 uploads and multipart assembly, your Cloudflare R2 bucket must have the following CORS policy configured in Cloudflare Dashboard → R2 → Bucket <strong>funclubsi</strong> → Settings → CORS Policy:
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-white/5 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
{`[
  {
    "AllowedOrigins": [
      "https://ais-dev-xy3pj537mkewt45u6b3qa5-265849145062.asia-southeast1.run.app",
      "https://ais-pre-xy3pj537mkewt45u6b3qa5-265849145062.asia-southeast1.run.app",
      "https://funclubsi.netlify.app",
      "http://localhost:3000",
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]`}
            </pre>
          </div>

          {/* Production Deployment Architecture Guide */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Production Environment Variables Reference
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">ADMIN_EMAIL</code>
                <span className="text-slate-400">Initial admin bootstrap email (only during 1st setup)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">ADMIN_INITIAL_PASSWORD</code>
                <span className="text-slate-400">Initial admin bootstrap password (hashed with bcrypt, not saved plain)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">DATABASE_URL</code>
                <span className="text-slate-400">PostgreSQL connection string with pooling</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">AUTH_SECRET</code>
                <span className="text-slate-400">Random 32+ character JWT signing key</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">R2_ACCOUNT_ID</code>
                <span className="text-slate-400">Cloudflare Account ID</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">R2_ACCESS_KEY_ID &amp; R2_SECRET_ACCESS_KEY</code>
                <span className="text-slate-400">S3 credentials generated with Object Read &amp; Write access</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
                <code className="text-cyan-300 font-mono">R2_BUCKET_NAME</code>
                <span className="text-slate-400">Target bucket name (e.g. funclubsi-media)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
