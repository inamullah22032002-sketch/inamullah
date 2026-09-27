import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Code2,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { UploadRecord } from '../../types';
import { api } from '../../services/api';

export const AdminStorageView: React.FC = () => {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketName, setBucketName] = useState('');
  const [r2Configured, setR2Configured] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [corsCopied, setCorsCopied] = useState(false);

  useEffect(() => {
    fetchStorage();
  }, []);

  const fetchStorage = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getUploads();
      setUploads(res.uploads || []);
      setBucketName(res.bucket);
      setR2Configured(res.r2Configured);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.admin.deleteUpload(id);
      setDeleteConfirmId(null);
      fetchStorage();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sampleCorsConfig = `[
  {
    "AllowedOrigins": [
      "https://YOUR-FUNCLUBSI-DOMAIN",
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Authorization"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]`;

  const copyCors = () => {
    navigator.clipboard.writeText(sampleCorsConfig);
    setCorsCopied(true);
    setTimeout(() => setCorsCopied(false), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white font-heading">
          Cloudflare R2 Storage Management
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Audited media objects, multipart upload tracking, and CORS configuration.
        </p>
      </div>

      {/* R2 Bucket Header Card */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              Active Bucket: {bucketName}
            </span>
            <span className={`text-[11px] font-mono ${r2Configured ? 'text-emerald-400' : 'text-amber-400'}`}>
              {r2Configured ? 'Direct S3 Protocol Connected' : 'Emulated Storage Driver Active'}
            </span>
          </div>
        </div>

        <button
          onClick={fetchStorage}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          title="Refresh storage"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Storage Files Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/40">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white font-heading uppercase tracking-wider">
            Uploaded Media Objects ({uploads.length})
          </h3>
          <span className="text-[11px] text-slate-400">Controlled deletion preserves orphan safety</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Inspecting storage records...</div>
        ) : uploads.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No objects stored yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-white/10 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Object Key</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {uploads.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white truncate max-w-xs">{u.filename}</td>
                    <td className="py-3 px-4 font-mono">{formatBytes(u.size)}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                      {u.objectKey}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          u.status === 'COMPLETED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : u.status === 'FAILED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyToClipboard(u.objectKey, u.id)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/5"
                          title="Copy Object Key"
                        >
                          {copiedKey === u.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(u.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                          title="Delete Object"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cloudflare R2 CORS Configuration Helper (Prompt Section 9 & 44) */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-heading">
              Cloudflare R2 CORS Configuration
            </h3>
          </div>
          <button
            onClick={copyCors}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
          >
            {corsCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {corsCopied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Configure this in your Cloudflare dashboard under <strong className="text-slate-200">R2 &gt; Bucket &gt; Settings &gt; CORS Policy</strong>. Note that <code className="text-cyan-300">ExposeHeaders: ["ETag"]</code> is mandatory so that browser multipart chunks can capture ETags during uploads.
        </p>

        <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-[11px] font-mono text-cyan-300 overflow-x-auto">
          {sampleCorsConfig}
        </pre>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Delete Storage Object</h3>
            </div>
            <p className="text-xs text-slate-300">
              This will permanently delete the binary object from Cloudflare R2 and remove its database tracking record.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Object'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
