import React, { useState, useEffect } from 'react';
import {
  Film,
  Search,
  Trash2,
  Edit,
  Eye,
  Plus,
  RefreshCw,
  Star,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Movie } from '../../types';
import { api } from '../../services/api';

interface AdminMoviesViewProps {
  onNavigateTab: (tab: string) => void;
  onPreviewMovie?: (movie: Movie) => void;
}

export const AdminMoviesView: React.FC<AdminMoviesViewProps> = ({ onNavigateTab, onPreviewMovie }) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchMovies();
  }, [search, filterType, filterStatus]);

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const res = await api.movies.list({
        q: search,
        type: filterType === 'all' ? undefined : filterType,
        status: filterStatus === 'all' ? 'all' : filterStatus,
        limit: 100,
      });
      setMovies(res.movies);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.admin.deleteMovie(id);
      setFeedback('Title removed from database and Cloudflare R2.');
      setDeleteConfirmId(null);
      fetchMovies();
    } catch (err: any) {
      setFeedback(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">
            Movie & TV Titles Catalog
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage publication states, metadata, and media links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('import')}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 border border-white/10 text-slate-200 hover:text-white rounded-xl transition-all"
          >
            Import From URL
          </button>
          <button
            onClick={() => onNavigateTab('upload')}
            className="px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Title
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, director, cast..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
          >
            <option value="all">All Content</option>
            <option value="movie">Movies Only</option>
            <option value="tv">TV Shows Only</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
      </div>

      {/* Movies Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          Loading titles...
        </div>
      ) : movies.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 rounded-2xl bg-slate-900/20 border border-white/5">
          No matching titles found in database.
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-white/10 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Title & Poster</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Views</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {movies.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={m.posterUrl}
                          alt={m.title}
                          className="w-8 h-12 object-cover rounded bg-slate-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-xs">{m.title}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-xs">
                            {m.genre?.slice(0, 3).join(', ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize">{m.type}</td>
                    <td className="py-3 px-4">{m.releaseYear}</td>
                    <td className="py-3 px-4">
                      {m.imdbRating ? (
                        <span className="flex items-center gap-1 text-amber-300">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {m.imdbRating.toFixed(1)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          m.status === 'published'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{m.views}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onPreviewMovie?.(m)}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/5"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                          title="Delete Title"
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
        </div>
      )}

      {/* Controlled Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Confirm Removal</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to permanently delete this movie from the database and release any associated Cloudflare R2 storage objects?
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
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
