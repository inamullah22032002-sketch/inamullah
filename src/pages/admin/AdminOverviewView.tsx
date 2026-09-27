import React, { useEffect, useState } from 'react';
import {
  Film,
  Tv,
  Users,
  HardDrive,
  Upload,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Database,
  CloudLightning,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { SystemStats } from '../../types';
import { api } from '../../services/api';

interface AdminOverviewViewProps {
  onNavigateTab: (tab: string) => void;
}

export const AdminOverviewView: React.FC<AdminOverviewViewProps> = ({ onNavigateTab }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.admin.stats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading || !stats) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        Compiling platform telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Infrastructure Status Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Database Engine:</span>
            <span className={`font-mono font-semibold ${stats.system.isPostgresConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {stats.system.isPostgresConnected ? 'PostgreSQL Pool Active' : 'Resilient In-Memory/Local Store'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <CloudLightning className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400">Object Storage:</span>
            <span className={`font-mono font-semibold ${stats.system.isR2Configured ? 'text-emerald-400' : 'text-amber-400'}`}>
              {stats.system.isR2Configured ? `Cloudflare R2 (${stats.system.bucketName})` : 'R2 Direct Emulation'}
            </span>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('upload')}
          className="px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          <Upload className="w-3.5 h-3.5" />
          Direct Video Upload
        </button>
      </div>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Movies */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/10 hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold">Total Movies</span>
            <div className="p-2 rounded-xl bg-cyan-950/60 text-cyan-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-heading">{stats.totalMovies}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Catalog titles in database</span>
        </div>

        {/* Total TV Shows */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/10 hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold">Total TV Shows</span>
            <div className="p-2 rounded-xl bg-indigo-950/60 text-indigo-400">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-heading">{stats.totalTVShows}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Episodic series</span>
        </div>

        {/* Total Users */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/10 hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold">Registered Users</span>
            <div className="p-2 rounded-xl bg-purple-950/60 text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-heading">{stats.totalUsers}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Active user accounts</span>
        </div>

        {/* Storage Used */}
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/10 hover:border-fuchsia-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold">Storage In R2</span>
            <div className="p-2 rounded-xl bg-fuchsia-950/60 text-fuchsia-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-heading">{formatBytes(stats.storageUsedBytes)}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">{stats.completedUploads} completed uploads</span>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/30 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Total Stream Views</span>
            <p className="text-xl font-bold text-white font-heading">{stats.totalViews.toLocaleString()}</p>
          </div>
          <Eye className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/30 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Completed Media Objects</span>
            <p className="text-xl font-bold text-emerald-400 font-heading">{stats.completedUploads}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-4 rounded-xl bg-slate-900/30 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Failed / Retried Uploads</span>
            <p className="text-xl font-bold text-rose-400 font-heading">{stats.failedUploads}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-400" />
        </div>
      </div>

      {/* Recent Uploads & Recently Added Movies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Uploads */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              Recent Video Uploads
            </h3>
            <button
              onClick={() => onNavigateTab('storage')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              Storage Manager <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats.recentUploads.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No video uploads recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentUploads.map((upl) => (
                <div
                  key={upl.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{upl.filename}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{formatBytes(upl.size)}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                      upl.status === 'COMPLETED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : upl.status === 'FAILED'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-cyan-950 text-cyan-400 border border-cyan-800 animate-pulse'
                    }`}
                  >
                    {upl.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Added Movies */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              Recently Added Titles
            </h3>
            <button
              onClick={() => onNavigateTab('movies')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              View Catalog <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats.recentMovies.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No titles have been added yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-3 text-xs"
                >
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-8 h-12 object-cover rounded bg-slate-900 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{movie.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {movie.releaseYear} · {movie.type === 'tv' ? 'TV' : 'Movie'} · {movie.views} views
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
                    {movie.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
