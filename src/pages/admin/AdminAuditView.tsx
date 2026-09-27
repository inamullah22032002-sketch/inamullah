import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  Mail,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { AuditLog } from '../../types';
import { api, getApiToken } from '../../services/api';

export const AdminAuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [total, setTotal] = useState(0);

  // Email report state
  const [supervisorEmail, setSupervisorEmail] = useState('supervisor@funclubsi.com');
  const [dispatching, setDispatching] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, userFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getAuditLogs({
        action: actionFilter || undefined,
        user: userFilter || undefined,
        limit: 100,
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const token = getApiToken();
    const url = `/api/admin/audit-logs/export.csv`;
    window.open(url, '_blank');
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleSendWeeklyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatching(true);
    setDispatchStatus(null);
    try {
      const res = await api.admin.sendWeeklyReport(supervisorEmail);
      setDispatchStatus(res.message);
    } catch (err: any) {
      setDispatchStatus(`Error: ${err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">
            Security & Governance Audit Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable tracking of role changes, administrative logins, and content lifecycle actions.
          </p>
        </div>

        {/* Export & Report Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-slate-200 hover:text-white rounded-xl transition-all flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-slate-200 hover:text-white rounded-xl transition-all flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            Print / PDF Report
          </button>
        </div>
      </div>

      {/* Automated Weekly Summary Dispatch Panel */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-cyan-500/20 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white font-heading uppercase tracking-wider">
            Automated Weekly Compliance & Audit Reporting
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Configure designated supervisor recipient. Automated weekly schedules deliver a compiled compliance audit digest without manual intervention.
        </p>

        {dispatchStatus && (
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{dispatchStatus}</span>
          </div>
        )}

        <form onSubmit={handleSendWeeklyReport} className="flex flex-wrap items-center gap-3 pt-1">
          <input
            type="email"
            required
            value={supervisorEmail}
            onChange={(e) => setSupervisorEmail(e.target.value)}
            placeholder="supervisor@domain.com"
            className="w-72 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white"
          />
          <button
            type="submit"
            disabled={dispatching}
            className="px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            {dispatching ? 'Queuing Summary...' : 'Dispatch Compliance Report Now'}
          </button>
        </form>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by user name or email..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="relative min-w-[180px]">
            <input
              type="text"
              placeholder="Filter action (e.g. LOGIN, MOVIE_CREATED)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          title="Refresh audit events"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Audit Events Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/40">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">No matching audit events recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-white/10 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-white">
                      {log.userName}
                      <span className="block text-[10px] text-slate-400 font-mono">{log.userEmail}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-cyan-300 border border-white/5 text-[10px]">
                        {log.userRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-cyan-400">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-xs">
                      {log.resource}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
