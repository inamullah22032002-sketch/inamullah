import React, { useState, useEffect } from 'react';
import { Users, Shield, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { User, UserRole } from '../../types';
import { api } from '../../services/api';

export const AdminUsersView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getUsers();
      setUsers(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    setMessage(null);
    try {
      const res = await api.admin.updateUserRole(userId, newRole);
      setMessage(`Updated role for ${res.user.email} to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      setMessage(`Failed to update role: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">
            User Governance & Role-Based Access Control
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage permissions, grant administrator privileges, and govern accounts.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
          title="Refresh users"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/40">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading user registry...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-white/10 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role Designation</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Modify Permission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white flex items-center gap-2.5">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.name}`}
                        alt={u.name}
                        className="w-7 h-7 rounded-full bg-slate-800"
                      />
                      <span>{u.name}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                          u.role === 'ADMIN'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : u.role === 'CONTENT_MANAGER'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            : u.role === 'MODERATOR'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800'
                            : 'bg-white/5 text-slate-300 border border-white/10'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        disabled={updatingId === u.id}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 text-xs text-white focus:border-cyan-400"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="CONTENT_MANAGER">CONTENT_MANAGER</option>
                        <option value="MODERATOR">MODERATOR</option>
                      </select>
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
