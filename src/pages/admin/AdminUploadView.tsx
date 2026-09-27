import React, { useState, useRef } from 'react';
import {
  Upload,
  Film,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  X,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  Eye,
  Plus,
  Trash2,
  Loader2,
  HelpCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { MultipartUploadManager, UploadProgressState } from '../../services/multipartUpload';
import { SubtitleTrack } from '../../types';

interface AdminUploadViewProps {
  onSuccess?: () => void;
}

export const AdminUploadView: React.FC<AdminUploadViewProps> = ({ onSuccess }) => {
  // File & Upload Manager state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadManager, setUploadManager] = useState<MultipartUploadManager | null>(null);
  const [progressState, setProgressState] = useState<UploadProgressState | null>(null);
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string>('');
  const [completedObjectKey, setCompletedObjectKey] = useState<string>('');

  // Movie Details Form
  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [description, setDescription] = useState('');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [type, setType] = useState<'movie' | 'tv'>('movie');
  const [genreInput, setGenreInput] = useState('Sci-Fi, Action');
  const [language, setLanguage] = useState('English');
  const [country, setCountry] = useState('USA');
  const [runtime, setRuntime] = useState<number>(120);
  const [ageRating, setAgeRating] = useState('PG-13');
  const [imdbRating, setImdbRating] = useState<string>('7.8');
  const [director, setDirector] = useState('');
  const [castInput, setCastInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [featured, setFeatured] = useState(false);

  // Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [subLang, setSubLang] = useState('en');
  const [subLabel, setSubLabel] = useState('English');
  const [subUrl, setSubUrl] = useState('');

  // AI Assist
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  // Preview & Submit
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setProgressState(null);
      setCompletedVideoUrl('');
      setCompletedObjectKey('');

      // Auto populate title from filename if title is empty
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
        setTitle(cleanName);
      }
    }
  };

  const handleStartMultipartUpload = () => {
    if (!videoFile) return;

    const manager = new MultipartUploadManager({
      file: videoFile,
      concurrency: 2,
      onProgress: (state) => setProgressState(state),
      onError: (err) => console.error('Upload Error:', err),
      onComplete: (result) => {
        setCompletedVideoUrl(result.publicUrl);
        setCompletedObjectKey(result.objectKey);
      },
    });

    setUploadManager(manager);
    manager.start();
  };

  const handleAiAssist = async () => {
    if (!title) {
      setFormError('Please enter a movie title before requesting AI metadata suggestions.');
      return;
    }
    setAiLoading(true);
    setFormError(null);
    setAiFeedback(null);
    try {
      const res = await api.admin.aiAssist(title, `${type}, ${releaseYear}`);
      const sug = res.suggestions;
      if (sug) {
        if (sug.description) setDescription(sug.description);
        if (sug.genres && Array.isArray(sug.genres)) setGenreInput(sug.genres.join(', '));
        if (sug.tags && Array.isArray(sug.tags)) setTagsInput(sug.tags.join(', '));
        if (sug.suggestedAgeRating) setAgeRating(sug.suggestedAgeRating);
        setAiFeedback('AI metadata suggestions generated! Review and customize below.');
      }
    } catch (err: any) {
      setFormError(`AI Assist notice: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddSubtitle = () => {
    if (!subUrl || !subLabel) return;
    const track: SubtitleTrack = {
      id: 'sub_' + Date.now(),
      movieId: 'pending',
      language: subLang,
      label: subLabel,
      fileUrl: subUrl,
      format: subUrl.endsWith('.srt') ? 'srt' : 'vtt',
    };
    setSubtitles([...subtitles, track]);
    setSubUrl('');
  };

  const handleRemoveSubtitle = (id: string) => {
    setSubtitles(subtitles.filter((s) => s.id !== id));
  };

  const handlePublish = async (status: 'published' | 'draft') => {
    if (!title || !description || !posterUrl) {
      setFormError('Title, description, and poster URL are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const movieData = {
        title,
        originalTitle,
        description,
        releaseYear,
        type,
        genre: genreInput.split(',').map((s) => s.trim()).filter(Boolean),
        language,
        country,
        runtime,
        ageRating,
        imdbRating: imdbRating ? parseFloat(imdbRating) : undefined,
        director,
        cast: castInput.split(',').map((s) => s.trim()).filter(Boolean),
        tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean),
        posterUrl,
        backdropUrl: backdropUrl || posterUrl,
        trailerUrl,
        videoObjectKey: completedObjectKey || undefined,
        videoUrl: completedVideoUrl || undefined,
        subtitles,
        status,
        featured,
      };

      await api.admin.createMovie(movieData);
      setFormSuccess(`Movie successfully saved as ${status.toUpperCase()}!`);
      setShowPreview(false);
      onSuccess?.();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save movie.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-bold text-white font-heading">
          Publish Title & Cloudflare R2 Video Upload
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Direct browser-to-R2 multipart video pipeline. High throughput with chunk-level auto-recovery.
        </p>
      </div>

      {formSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {formError && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* SECTION 1: CLOUDFLARE R2 MULTIPART VIDEO UPLOADER */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileVideo className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-heading">
              1. Large Video Direct Multipart Upload (R2 S3-Compatible)
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            50MB Chunking Engine
          </span>
        </div>

        {/* Video selector area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-cyan-500/50 rounded-2xl p-6 text-center cursor-pointer bg-slate-950/50 transition-all hover:bg-slate-950/80 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/mkv,video/quicktime"
            onChange={handleSelectVideo}
            className="hidden"
          />
          <Upload className="w-10 h-10 mx-auto text-slate-500 group-hover:text-cyan-400 transition-colors mb-2" />
          <p className="text-xs font-semibold text-white">
            {videoFile ? `Selected: ${videoFile.name} (${formatMb(videoFile.size)} MB)` : 'Click to select large video file'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Directly uploads chunks to Cloudflare R2 bucket. Max 50GB.
          </p>
        </div>

        {/* Multipart Upload Control & Progress Console */}
        {videoFile && (
          <div className="p-4 rounded-xl bg-slate-950/90 border border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-white block">{videoFile.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Total Size: {formatMb(videoFile.size)} MB
                </span>
              </div>

              {/* Action Buttons: Start, Pause, Resume, Cancel, Retry */}
              <div className="flex items-center gap-2">
                {!progressState || progressState.status === 'IDLE' ? (
                  <button
                    onClick={handleStartMultipartUpload}
                    className="px-4 py-1.5 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg shadow-sm"
                  >
                    Start Multipart Upload
                  </button>
                ) : null}

                {progressState && progressState.status === 'UPLOADING' && (
                  <button
                    onClick={() => uploadManager?.pause()}
                    className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-500/30 rounded-lg flex items-center gap-1"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                )}

                {progressState && progressState.status === 'PAUSED' && (
                  <button
                    onClick={() => uploadManager?.resume()}
                    className="px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 rounded-lg flex items-center gap-1"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                )}

                {progressState && progressState.status === 'FAILED' && (
                  <button
                    onClick={() => uploadManager?.retry()}
                    className="px-3 py-1.5 text-xs font-medium text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry Chunk
                  </button>
                )}

                {progressState && ['UPLOADING', 'PAUSED', 'RETRYING'].includes(progressState.status) && (
                  <button
                    onClick={() => uploadManager?.cancel()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Progress details */}
            {progressState && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-cyan-300">
                    Status: {progressState.status}
                  </span>
                  <span className="font-mono text-white">
                    {progressState.percentage}% ({formatMb(progressState.uploadedBytes)} / {formatMb(progressState.totalBytes)} MB)
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${progressState.percentage}%` }}
                  ></div>
                </div>

                <div className="flex flex-wrap justify-between text-[11px] text-slate-400 font-mono gap-1">
                  <span>Strategy: <strong className="text-cyan-400">{progressState.uploadStrategy === 'direct-single' ? 'Direct R2 PutObject' : 'Direct R2 S3 Multipart'}</strong></span>
                  <span>Part: {progressState.currentPart} / {progressState.totalParts}</span>
                  <span>Speed: {(progressState.speedBps / (1024 * 1024)).toFixed(2)} MB/s</span>
                  <span>Remaining: ~{progressState.timeRemainingSeconds}s</span>
                </div>

                {progressState.errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Direct R2 Upload Error</span>
                    </div>
                    <p className="font-mono text-[11px] leading-relaxed">{progressState.errorMessage}</p>
                  </div>
                )}
              </div>
            )}

            {completedObjectKey && (
              <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Multipart assembly finished! Object key: <strong className="font-mono">{completedObjectKey}</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: MOVIE METADATA FORM WITH SERVER-SIDE AI ASSIST */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-heading">
              2. Title Metadata & Cinematic Information
            </h3>
          </div>

          {/* AI Metadata Assistant Button */}
          <button
            type="button"
            onClick={handleAiAssist}
            disabled={aiLoading}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-900/30 hover:shadow-purple-900/50 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
            {aiLoading ? 'Generating...' : 'AI Metadata Assist (Gemini)'}
          </button>
        </div>

        {aiFeedback && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{aiFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Title */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Movie / TV Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cyberpunk Nexus 2099"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Original Title */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Original Title (Optional)</label>
            <input
              type="text"
              value={originalTitle}
              onChange={(e) => setOriginalTitle(e.target.value)}
              placeholder="e.g. Nexus Original"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Type & Year */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Content Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value="movie">Movie</option>
              <option value="tv">TV Series</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Release Year *</label>
            <input
              type="number"
              value={releaseYear}
              onChange={(e) => setReleaseYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Genre & Runtime */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Genres (comma separated)</label>
            <input
              type="text"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
              placeholder="Action, Sci-Fi, Thriller"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Runtime (minutes)</label>
            <input
              type="number"
              value={runtime}
              onChange={(e) => setRuntime(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* IMDb Rating & Age Rating */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">IMDb Rating (e.g. 8.4)</label>
            <input
              type="text"
              value={imdbRating}
              onChange={(e) => setImdbRating(e.target.value)}
              placeholder="8.4"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Age Rating</label>
            <input
              type="text"
              value={ageRating}
              onChange={(e) => setAgeRating(e.target.value)}
              placeholder="PG-13, R, TV-MA"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Director & Language */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Director</label>
            <input
              type="text"
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              placeholder="Denis Villeneuve"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Language</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Cast & Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Starring Cast (comma separated)</label>
            <input
              type="text"
              value={castInput}
              onChange={(e) => setCastInput(e.target.value)}
              placeholder="Keanu Reeves, Carrie-Anne Moss"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Tags / Keywords</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="cyberpunk, futuristic, ai, dystopia"
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Poster & Backdrop URLs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Poster Image URL *</label>
            <input
              type="url"
              required
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Backdrop Banner URL</label>
            <input
              type="url"
              value={backdropUrl}
              onChange={(e) => setBackdropUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Description / Synopsis */}
        <div className="text-xs">
          <label className="block font-semibold text-slate-300 mb-1">Synopsis / Description *</label>
          <textarea
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Engaging synopsis describing the film..."
            className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
          ></textarea>
        </div>

        {/* Trailer URL & Featured toggle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Trailer Video / Stream URL</label>
            <input
              type="url"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="pt-4">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="rounded bg-slate-950 border-white/20 text-cyan-400 focus:ring-0"
              />
              Show in Featured Hero Carousel on Homepage
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 3: SUBTITLE TRACKS */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-white font-heading">
          3. Subtitles (.vtt / .srt)
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Language code (e.g. en, es, fr)"
            value={subLang}
            onChange={(e) => setSubLang(e.target.value)}
            className="w-32 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
          />
          <input
            type="text"
            placeholder="Label (e.g. English CC)"
            value={subLabel}
            onChange={(e) => setSubLabel(e.target.value)}
            className="w-36 px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
          />
          <input
            type="url"
            placeholder="Subtitle file URL (.vtt / .srt)"
            value={subUrl}
            onChange={(e) => setSubUrl(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white"
          />
          <button
            type="button"
            onClick={handleAddSubtitle}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Track
          </button>
        </div>

        {subtitles.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {subtitles.map((sub) => (
              <div
                key={sub.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-between"
              >
                <span>{sub.label} ({sub.language}) - {sub.fileUrl}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSubtitle(sub.id)}
                  className="text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: PREVIEW & PUBLISH CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="px-5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-2"
        >
          <Eye className="w-4 h-4 text-cyan-400" />
          {showPreview ? 'Hide Preview' : 'Show Publication Preview'}
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handlePublish('draft')}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handlePublish('published')}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50"
          >
            {submitting ? 'Publishing...' : 'Publish to FunclubSI'}
          </button>
        </div>
      </div>

      {/* Publication Preview Card */}
      {showPreview && (
        <div className="p-6 rounded-2xl bg-slate-950 border border-cyan-500/40 shadow-2xl space-y-4 animate-in fade-in">
          <h4 className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
            Catalog Card Preview
          </h4>
          <div className="max-w-xs">
            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-white/10">
              <div className="aspect-[2/3] w-full bg-slate-950">
                {posterUrl ? (
                  <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                    Poster Image Placeholder
                  </div>
                )}
              </div>
              <div className="p-3">
                <h5 className="text-sm font-semibold text-white truncate font-heading">
                  {title || 'Untitled Movie'}
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {releaseYear} · {type === 'tv' ? 'TV' : 'Movie'} · {genreInput}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
