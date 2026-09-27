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
  EyeOff
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

  useEffect(() => {
    fetchStats();
  }, []);

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
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudLightning className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white font-heading">Cloudflare R2 Storage</h3>
                </div>
                {stats?.system.isR2Configured ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> S3 Client Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Direct Emulation
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {stats?.system.isR2Configured
                  ? `Connected to bucket '${stats.system.bucketName}'. Browser uploads bypass backend and stream directly to R2.`
                  : 'R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY omitted in environment. Direct emulation handles chunk testing.'}
              </p>
            </div>
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
