import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  CloudLightning,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  KeyRound
} from 'lucide-react';
import { api } from '../../services/api';

export const AdminSettingsView: React.FC = () => {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-white font-heading">
          System & Storage Configuration
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Verify connected cloud infrastructure, database drivers, and security keys.
        </p>
      </div>

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
          <div className="p-3 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row justify-between gap-2">
            <code className="text-cyan-300 font-mono">GEMINI_API_KEY</code>
            <span className="text-slate-400">Optional: Powers AI Metadata generation assistant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
