import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Server,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Clock,
  Radio,
  BellRing
} from 'lucide-react';
import { HealthReport } from '../../types';
import { api } from '../../services/api';

export const AdminAnalyticsView: React.FC = () => {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchHealth();
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(fetchHealth, 8000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchHealth = async () => {
    try {
      const res = await api.admin.health();
      setHealth(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">
            System Telemetry & Performance Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time server telemetry, automated anomaly detection, and operational alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              autoRefresh
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-white/10'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            Live Polling (8s)
          </button>
          <button
            onClick={fetchHealth}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !health ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading telemetry data...</div>
      ) : !health ? (
        <div className="py-16 text-center text-xs text-rose-400">Failed to load system health.</div>
      ) : (
        <>
          {/* Anomaly Alerts Console */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white font-heading uppercase tracking-wider">
                Real-Time Automated Anomaly Detection
              </h3>
            </div>

            {health.anomalies.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All platform systems operating within optimal performance tolerances.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {health.anomalies.map((anom, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                      anom.level === 'critical'
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                        : anom.level === 'warning'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                        : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">{anom.title}</strong>
                      <p className="mt-0.5 leading-relaxed opacity-90">{anom.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Memory Usage */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Node RSS Memory</span>
                <Server className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-bold text-white font-heading">{health.processMemoryMb} MB</p>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full"
                  style={{ width: `${Math.min(100, (health.processMemoryMb / 512) * 100)}%` }}
                ></div>
              </div>
              <span className="text-[11px] text-slate-500 block">Resident Set Size in runtime</span>
            </div>

            {/* System RAM Percent */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">Host System RAM</span>
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-white font-heading">{health.systemMemoryPercent}%</p>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${health.systemMemoryPercent}%` }}
                ></div>
              </div>
              <span className="text-[11px] text-slate-500 block">Host total memory utilization</span>
            </div>

            {/* Node Uptime */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold">System Continuous Uptime</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white font-heading">{formatUptime(health.uptimeSeconds)}</p>
              <span className="text-[11px] text-emerald-400 block font-mono">Service online & responsive</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
