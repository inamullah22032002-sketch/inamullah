import React, { useState } from 'react';
import {
  Globe,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Film,
  Edit3,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { api } from '../../services/api';

interface AdminImportViewProps {
  onSuccess?: () => void;
}

export const AdminImportView: React.FC<AdminImportViewProps> = ({ onSuccess }) => {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Extracted and editable fields
  const [extracted, setExtracted] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [description, setDescription] = useState('');
  const [releaseYear, setReleaseYear] = useState<number>(2024);
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [genreInput, setGenreInput] = useState('');
  const [runtime, setRuntime] = useState<number>(120);
  const [director, setDirector] = useState('');
  const [castInput, setCastInput] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [imdbRating, setImdbRating] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setAnalyzing(true);
    setAnalysisError(null);
    setExtracted(null);
    setSaveSuccess(null);

    try {
      const res = await api.admin.analyzeUrl(url);
      const meta = res.metadata;
      setExtracted(meta);

      // Populate editable fields
      setTitle(meta.title || '');
      setOriginalTitle(meta.originalTitle || '');
      setDescription(meta.description || '');
      setReleaseYear(meta.releaseYear || new Date().getFullYear());
      setType(meta.type || 'movie');
      setGenreInput(meta.genre ? meta.genre.join(', ') : 'Action, Drama');
      setRuntime(meta.runtime || 110);
      setDirector(meta.director || '');
      setCastInput(meta.cast ? meta.cast.join(', ') : '');
      setPosterUrl(meta.posterUrl || '');
      setBackdropUrl(meta.backdropUrl || meta.posterUrl || '');
      setTrailerUrl(meta.trailerUrl || '');
      setImdbRating(meta.imdbRating ? String(meta.imdbRating) : '7.5');
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to extract movie metadata from this URL.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveImport = async (status: 'published' | 'draft') => {
    if (!title || !description || !posterUrl) {
      setAnalysisError('Title, description, and poster URL are required.');
      return;
    }

    setSaving(true);
    setAnalysisError(null);
    try {
      await api.admin.createMovie({
        title,
        originalTitle,
        description,
        releaseYear,
        type,
        genre: genreInput.split(',').map((s) => s.trim()).filter(Boolean),
        runtime,
        director,
        cast: castInput.split(',').map((s) => s.trim()).filter(Boolean),
        posterUrl,
        backdropUrl,
        trailerUrl,
        imdbRating: imdbRating ? parseFloat(imdbRating) : undefined,
        status,
        language: 'English',
        country: 'USA',
        tags: ['imported', 'web-metadata'],
      });

      setSaveSuccess(`Title successfully imported and cataloged as ${status.toUpperCase()}!`);
      setExtracted(null);
      setUrl('');
      onSuccess?.();
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to catalog imported title.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white font-heading">
          Import Movie / TV Metadata From URL
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Extracts public OpenGraph, Schema.org JSON-LD, and feed metadata. Fully protected by server-side SSRF validation.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {analysisError && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* Input URL Form */}
      <form onSubmit={handleAnalyze} className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Target Web Page or Metadata Source URL
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.themoviedb.org/movie/... or https://imdb.com/title/..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>SSRF Guard active: local networks, private IP ranges, and cloud metadata ports are strictly rejected.</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={analyzing}
          className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {analyzing ? 'Inspecting Web Page...' : 'Analyze URL'}
        </button>
      </form>

      {/* IMPORT PREVIEW & FIELD EDITOR (Prompt Section 12) */}
      {extracted && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/30 space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-semibold">
                Detected Metadata Provider: {extracted.provider}
              </span>
              <h3 className="text-base font-bold text-white font-heading">
                Import Preview & Customization
              </h3>
            </div>
            <span className="text-xs text-slate-400">Review and edit any field before saving</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Release Year</label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Genres</label>
              <input
                type="text"
                value={genreInput}
                onChange={(e) => setGenreInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Director</label>
              <input
                type="text"
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Poster Image URL *</label>
              <input
                type="url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Backdrop Image URL</label>
              <input
                type="url"
                value={backdropUrl}
                onChange={(e) => setBackdropUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Starring Cast</label>
              <input
                type="text"
                value={castInput}
                onChange={(e) => setCastInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Description / Plot *</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
              ></textarea>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setExtracted(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveImport('draft')}
              className="px-5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl disabled:opacity-50"
            >
              Import as Draft
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveImport('published')}
              className="px-6 py-2 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl shadow-lg shadow-cyan-500/25 disabled:opacity-50"
            >
              {saving ? 'Importing...' : 'Publish to Catalog'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
